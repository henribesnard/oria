"""Mission 3 -- Jour J : execution complete du plan Matchday.

Charge le plan.json genere par le prevol, authentifie les personas,
demarre le watchdog, execute toutes les vagues, collecte l'oracle,
puis produit le pack de handoff.

Lancer : uv run python -m tests.matchday.matchday_run
Prerequis : serveur ORIA en ecoute sur localhost:8000
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from tests.matchday.checks import check_run, export_check_report
from tests.matchday.oracle import collect_oracle
from tests.matchday.pack import build_pack, create_manifest, create_run_dir
from tests.matchday.personas import (
    Persona,
    build_personas,
    create_persona_account,
    export_personas,
)
from tests.matchday.plan import MatchTarget, QuestionSpec, RunPlan, WavePlan
from tests.matchday.runner import export_metrics, run_all_waves
from tests.matchday.watchdog import Watchdog

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("matchday_run")

BASE_URL = "http://localhost:8000"
ADMIN_TOKEN = os.environ.get("ADMIN_BOOTSTRAP_TOKEN", "changeme")

# Delai entre questions (secondes) — assez pour ne pas saturer le rate limiter
DELAY_BETWEEN_QUESTIONS = 2.0
# Delai entre vagues (secondes)
DELAY_BETWEEN_WAVES = 5.0
# Intervalle watchdog (secondes)
WATCHDOG_INTERVAL = 30.0


# =====================================================================
# Chargement du plan.json
# =====================================================================

def load_plan(plan_path: Path) -> RunPlan:
    """Charge le plan.json genere par le prevol."""
    data = json.loads(plan_path.read_text(encoding="utf-8"))

    matches = [
        MatchTarget(**m) for m in data.get("matches", [])
    ]

    waves = []
    for w in data.get("waves", []):
        questions = [
            QuestionSpec(**q) for q in w.get("questions", [])
        ]
        waves.append(WavePlan(
            wave_id=w["wave_id"],
            description=w["description"],
            questions=questions,
        ))

    return RunPlan(
        created_utc=data["created_utc"],
        mode=data.get("mode", "live"),
        matches=matches,
        waves=waves,
        total_questions=data.get("total_questions", 0),
        estimated_api_calls=data.get("estimated_api_calls", 0),
    )


# =====================================================================
# Pre-checks
# =====================================================================

async def preflight_checks(client: httpx.AsyncClient) -> bool:
    """Verifications pre-run. Retourne True si le run peut demarrer."""
    logger.info("--- Preflight checks ---")
    ok = True

    # 1. Health
    try:
        resp = await client.get(f"{BASE_URL}/health", timeout=5.0)
        if resp.status_code != 200:
            logger.error("server unhealthy: %d", resp.status_code)
            return False
        health = resp.json()
        logger.info("  health: %s (%d modules)",
                     health.get("status"), len(health.get("modules", {})))
    except Exception as e:
        logger.error("server unreachable: %s", e)
        return False

    # 2. Quota
    try:
        resp = await client.get(
            f"{BASE_URL}/admin/quota",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
            timeout=5.0,
        )
        if resp.status_code == 200:
            quota = resp.json()
            remaining = quota.get("remaining_budget", 0)
            daily = quota.get("daily_budget", 0)
            logger.info("  quota: remaining=%d, daily_budget=%d, calls_today=%d",
                        remaining, daily, quota.get("calls_today", 0))
            if remaining < 500:
                logger.error("quota trop bas: %d restants", remaining)
                ok = False
        else:
            logger.warning("  quota check failed: %d", resp.status_code)
    except Exception as e:
        logger.warning("  quota check error: %s", e)

    # 3. Entitlements differencies
    try:
        resp = await client.get(
            f"{BASE_URL}/admin/entitlements",
            headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
            timeout=5.0,
        )
        if resp.status_code == 200:
            ent = resp.json()
            free = ent.get("free", {})
            prem = ent.get("premium", {})
            if free == prem:
                logger.warning("  entitlements: free = premium (non differencies)")
            else:
                logger.info("  entitlements: free=%s, premium=%s",
                            free.get("chat_message"), prem.get("chat_message"))
    except Exception as e:
        logger.warning("  entitlements check: %s", e)

    # 4. Chat/public fonctionne
    try:
        resp = await client.post(
            f"{BASE_URL}/chat/public",
            json={"text": "salut", "context": {}},
            timeout=15.0,
        )
        if resp.status_code == 200:
            logger.info("  chat/public: OK")
        else:
            logger.error("  chat/public: %d", resp.status_code)
            ok = False
    except Exception as e:
        logger.error("  chat/public: %s", e)
        ok = False

    return ok


# =====================================================================
# Main
# =====================================================================

async def main() -> None:
    t_start = time.perf_counter()
    logger.info("=" * 70)
    logger.info("MISSION 3 -- JOUR J MATCHDAY ORIA")
    logger.info("=" * 70)

    # Localiser le plan.json
    plan_path = Path(__file__).parent / "plan.json"
    if not plan_path.exists():
        logger.error("plan.json introuvable: %s", plan_path)
        logger.error("Executer d'abord le prevol (Mission 2)")
        sys.exit(1)

    # Charger le plan
    logger.info("loading plan from %s...", plan_path.name)
    plan = load_plan(plan_path)
    logger.info("  plan: %d waves, %d questions, %d matchs",
                len(plan.waves), plan.total_questions, len(plan.matches))

    # Creer le repertoire du run
    run_dir = create_run_dir()
    logger.info("run dir: %s", run_dir)

    # Copier le plan dans le run
    (run_dir / "plan.json").write_text(
        plan_path.read_text(encoding="utf-8"), encoding="utf-8",
    )

    async with httpx.AsyncClient() as client:

        # Preflight checks
        if not await preflight_checks(client):
            logger.error("PREFLIGHT FAILED — run annule")
            sys.exit(1)

        # Authentifier les personas
        logger.info("--- Setup personas ---")
        personas = build_personas()
        for p in personas:
            await create_persona_account(client, p)

        # Compter les comptes actifs
        authed = sum(1 for p in personas if p.user_id and not p.is_guest)
        guests = sum(1 for p in personas if p.is_guest)
        logger.info("  %d comptes authentifies, %d guests", authed, guests)

        export_personas(personas, run_dir / "personas.json")

        # Differencier entitlements (au cas ou le serveur a ete relance)
        logger.info("--- Entitlements ---")
        try:
            resp = await client.patch(
                f"{BASE_URL}/admin/entitlements/free",
                json={
                    "chat_message": 50,
                    "live_realtime": False,
                    "alert": 5,
                    "deep_analysis": False,
                    "history_days": 30,
                },
                headers={"Authorization": f"Bearer {ADMIN_TOKEN}"},
                timeout=5.0,
            )
            if resp.status_code == 200:
                logger.info("  entitlements free: restreints")
            else:
                logger.warning("  PATCH entitlements/free: %d", resp.status_code)
        except Exception as e:
            logger.warning("  entitlements patch failed: %s", e)

        # Collecter l'oracle AVANT le run
        logger.info("--- Oracle (pre-run) ---")
        oracle_matches = [asdict(m) for m in plan.matches]
        await collect_oracle(client, oracle_matches, run_dir / "oracle")

        # Demarrer le watchdog
        logger.info("--- Watchdog ---")
        watchdog = Watchdog(
            admin_token=ADMIN_TOKEN,
            logs_dir=run_dir / "logs",
            poll_interval=WATCHDOG_INTERVAL,
        )
        await watchdog.start()

        # Executer toutes les vagues
        logger.info("")
        logger.info("=" * 70)
        logger.info("EXECUTION DES VAGUES (%d waves, %d questions)",
                    len(plan.waves), plan.total_questions)
        logger.info("=" * 70)

        personas_map = {p.name: p for p in personas}
        exchanges = await run_all_waves(
            plan=plan,
            personas=personas_map,
            run_dir=run_dir,
            delay_between_questions=DELAY_BETWEEN_QUESTIONS,
        )

        logger.info("")
        logger.info("--- Execution terminee: %d echanges ---", len(exchanges))

        # Collecter l'oracle APRES le run
        logger.info("--- Oracle (post-run) ---")
        post_oracle_dir = run_dir / "oracle" / "post_run"
        post_oracle_dir.mkdir(parents=True, exist_ok=True)
        await collect_oracle(client, oracle_matches, post_oracle_dir)

        # Arreter le watchdog
        await watchdog.stop()

    # Exporter les metriques
    logger.info("--- Metriques ---")
    export_metrics(exchanges, run_dir / "metrics")

    # Ecrire les logs du run
    t_elapsed = time.perf_counter() - t_start
    logs_dir = run_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    run_log = {
        "started_utc": plan.created_utc,
        "finished_utc": datetime.now(tz=UTC).isoformat(timespec="milliseconds"),
        "mode": "live",
        "total_exchanges": len(exchanges),
        "matches_count": len(plan.matches),
        "waves_count": len(plan.waves),
        "elapsed_seconds": round(t_elapsed, 1),
        "errors": sum(1 for e in exchanges if e.error),
        "degraded": sum(1 for e in exchanges if e.degraded),
        "watchdog_alerts": len(watchdog.alerts),
    }
    (logs_dir / "run_summary.json").write_text(
        json.dumps(run_log, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Creer le manifest
    logger.info("--- Manifest ---")
    create_manifest(
        run_dir=run_dir,
        mode="live",
        total_exchanges=len(exchanges),
        matches_count=len(plan.matches),
        waves_count=len(plan.waves),
        api_calls_estimate=plan.estimated_api_calls,
    )

    # Verifications
    logger.info("--- Checks ---")
    report = check_run(run_dir)
    export_check_report(report, run_dir / "checks_report.json")

    # Construire le pack
    logger.info("--- Pack ---")
    zip_path = build_pack(run_dir)

    # Resume final
    logger.info("")
    logger.info("=" * 70)
    logger.info("MISSION 3 -- JOUR J TERMINE")
    logger.info("=" * 70)
    logger.info("  Run dir      : %s", run_dir)
    logger.info("  Pack         : %s", zip_path)
    logger.info("  Exchanges    : %d", len(exchanges))
    logger.info("  Errors       : %d", sum(1 for e in exchanges if e.error))
    logger.info("  Degraded     : %d", sum(1 for e in exchanges if e.degraded))
    logger.info("  WD Alerts    : %d", len(watchdog.alerts))
    logger.info("  Checks       : %s", report.summary)
    logger.info("  Elapsed      : %.0fs", t_elapsed)
    logger.info("")

    if not report.all_passed:
        logger.warning("ATTENTION: certains checks ont echoue !")
        for c in report.checks:
            if not c.passed:
                logger.warning("  FAIL: %s -- %s", c.name, c.detail)

    # Metriques resumees
    ok_count = sum(1 for e in exchanges if not e.error and not e.degraded)
    err_count = sum(1 for e in exchanges if e.error)
    deg_count = sum(1 for e in exchanges if e.degraded)
    latencies = [e.latency_ms for e in exchanges if e.latency_ms > 0]
    avg_lat = sum(latencies) / len(latencies) if latencies else 0

    logger.info("")
    logger.info("RESUME:")
    logger.info("  OK=%d  Degraded=%d  Errors=%d  Latence_moy=%.0fms",
                ok_count, deg_count, err_count, avg_lat)


if __name__ == "__main__":
    asyncio.run(main())
