"""Dry-run -- validation du harness contre des matchs termines.

Produit un mini-pack de ~20 echanges pour valider le format
avant le jour J.

Lancer : uv run python -m tests.matchday.dry_run
Prerequis : serveur ORIA en ecoute sur localhost:8000
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from dataclasses import asdict
from datetime import UTC, datetime
from pathlib import Path

import httpx

from tests.matchday.checks import check_run, export_check_report
from tests.matchday.oracle import collect_oracle
from tests.matchday.pack import build_pack, create_manifest, create_run_dir
from tests.matchday.personas import Persona, build_personas, export_personas
from tests.matchday.plan import (
    build_plan,
    export_plan,
    fetch_finished_matches,
)
from tests.matchday.runner import export_metrics, run_all_waves

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("dry_run")

# Date a utiliser pour trouver des matchs termines (hier ou avant-hier)
FIXTURE_DATE = "2026-08-14"
MAX_MATCHES = 2
QUESTIONS_PER_MATCH = 6  # 6 questions/match + 8 generiques = 20 total


async def main() -> None:
    logger.info("=" * 70)
    logger.info("DRY-RUN MATCHDAY ORIA")
    logger.info("=" * 70)

    # 1. Creer le repertoire du run
    run_dir = create_run_dir()
    logger.info("run dir: %s", run_dir)

    async with httpx.AsyncClient() as client:

        # 2. Verifier que le serveur est up
        logger.info("checking server health...")
        try:
            resp = await client.get("http://localhost:8000/health", timeout=5.0)
            if resp.status_code != 200:
                logger.error("server unhealthy: %d", resp.status_code)
                return
            health = resp.json()
            logger.info("server status: %s", health.get("status", "unknown"))
        except Exception as e:
            logger.error("server unreachable: %s", e)
            return

        # 3. Recuperer des matchs termines
        logger.info("fetching finished matches from %s...", FIXTURE_DATE)
        matches = await fetch_finished_matches(client, FIXTURE_DATE, max_matches=MAX_MATCHES)
        if not matches:
            logger.error("no finished matches found for %s", FIXTURE_DATE)
            return
        for m in matches:
            logger.info(
                "  match: %s %s-%s %s (%s, %s)",
                m.home_team, m.score_home, m.score_away, m.away_team,
                m.league_name, m.status,
            )

        # 4. Construire les personas (mode dry-run = guests seulement)
        logger.info("building personas (dry-run: guests only)...")
        all_personas = build_personas()
        # Pour le dry-run, on n'a pas besoin de creer les comptes
        # On utilise les guests (pas d'auth requise)
        guest_personas = [p for p in all_personas if p.is_guest]
        # Ajouter un "guest_dryrun" pour les questions authentifiees
        # qui tomberont en fallback vers /chat/public
        dryrun_persona = Persona(name="dryrun_user", tier="guest", description="Dry-run user")
        active_personas = guest_personas + [dryrun_persona]

        export_personas(all_personas, run_dir / "personas.json")

        # 5. Construire le plan
        logger.info("building plan...")
        persona_names = [p.name for p in active_personas]
        plan = build_plan(
            matches=matches,
            persona_names=persona_names,
            mode="dry-run",
            questions_per_match=QUESTIONS_PER_MATCH,
        )
        export_plan(plan, run_dir / "plan.json")
        logger.info(
            "plan: %d waves, %d questions, ~%d API calls estimated",
            len(plan.waves), plan.total_questions, plan.estimated_api_calls,
        )

        # 6. Collecter l'oracle (verite terrain)
        logger.info("collecting oracle data...")
        oracle_matches = [asdict(m) for m in matches]
        await collect_oracle(client, oracle_matches, run_dir / "oracle")

        # 7. Executer les vagues
        logger.info("executing waves...")
        personas_map = {p.name: p for p in active_personas}
        exchanges = await run_all_waves(
            plan=plan,
            personas=personas_map,
            run_dir=run_dir,
            delay_between_questions=0.5,  # dry-run: delai court
        )

        logger.info("completed: %d exchanges", len(exchanges))

    # 8. Exporter les metriques
    logger.info("exporting metrics...")
    export_metrics(exchanges, run_dir / "metrics")

    # 9. Ecrire les logs du run
    logs_dir = run_dir / "logs"
    logs_dir.mkdir(parents=True, exist_ok=True)
    run_log = {
        "started_utc": plan.created_utc,
        "finished_utc": datetime.now(tz=UTC).isoformat(timespec="milliseconds"),
        "mode": "dry-run",
        "fixture_date": FIXTURE_DATE,
        "matches": len(matches),
        "total_exchanges": len(exchanges),
        "errors": sum(1 for e in exchanges if e.error),
        "degraded": sum(1 for e in exchanges if e.degraded),
    }
    (logs_dir / "run_summary.json").write_text(
        json.dumps(run_log, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # 10. Creer le manifest
    logger.info("creating manifest...")
    create_manifest(
        run_dir=run_dir,
        mode="dry-run",
        total_exchanges=len(exchanges),
        matches_count=len(matches),
        waves_count=len(plan.waves),
        api_calls_estimate=plan.estimated_api_calls,
    )

    # 11. Verifications
    logger.info("running checks...")
    report = check_run(run_dir)
    export_check_report(report, run_dir / "checks_report.json")

    # 12. Construire le pack
    logger.info("building pack...")
    zip_path = build_pack(run_dir)

    # Resume final
    logger.info("")
    logger.info("=" * 70)
    logger.info("DRY-RUN TERMINE")
    logger.info("=" * 70)
    logger.info("  Run dir   : %s", run_dir)
    logger.info("  Pack      : %s", zip_path)
    logger.info("  Exchanges : %d", len(exchanges))
    logger.info("  Errors    : %d", sum(1 for e in exchanges if e.error))
    logger.info("  Degraded  : %d", sum(1 for e in exchanges if e.degraded))
    logger.info("  Checks    : %s", report.summary)

    if not report.all_passed:
        logger.warning("ATTENTION: certains checks ont echoue !")
        for c in report.checks:
            if not c.passed:
                logger.warning("  FAIL: %s — %s", c.name, c.detail)

    logger.info("")
    logger.info("Prochaine etape : ouvrir un echange au hasard dans raw/")
    logger.info("et verifier qu'il est jugeable sans ouvrir un autre fichier.")


if __name__ == "__main__":
    asyncio.run(main())
