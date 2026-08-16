"""Runner -- orchestrateur de vagues HTTP.

Envoie les questions du plan via HTTP, collecte les reponses,
mesure les latences, et ecrit les echanges dans raw/.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

from tests.matchday.personas import Persona
from tests.matchday.plan import QuestionSpec, RunPlan, WavePlan

logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000"


@dataclass
class Exchange:
    """Un echange complet : question + reponse + metadonnees."""

    exchange_id: str
    ts_utc: str  # ISO 8601 avec ms
    wave: str
    persona: str
    persona_tier: str
    category: str
    question: str
    context: dict[str, Any]
    fixture_ref: int | None

    # Reponse ORIA
    response_text: str = ""
    attachments: list[dict[str, Any]] = field(default_factory=list)
    suggested_actions: list[dict[str, Any]] = field(default_factory=list)
    degraded: bool = False
    freshness: str | None = None

    # Metriques
    latency_ms: float = 0.0
    http_status: int = 0
    error: str | None = None

    # Classification
    route: str = ""  # prerouter | orchestrator | fallback | error


def classify_route(resp: dict[str, Any]) -> str:
    """Determine la route empruntee depuis la reponse."""
    text = resp.get("text", "")
    degraded = resp.get("degraded", False)
    attachments = resp.get("attachments", [])

    if degraded and ("pas pu traiter" in text or "reformuler" in text):
        return "fallback"

    if "Je suis Oria" in text and "modifier mes instructions" in text:
        return "safety:injection"
    if "Joueurs Info Service" in text:
        return "safety:gambling"

    prerouter_starts = [
        "Voici le", "Voici la", "Voici les", "Aucun match",
        "Salut !", "Avec plaisir", "Je peux t'aider",
        "De quel championnat",
    ]
    for p in prerouter_starts:
        if text.startswith(p):
            return "prerouter"

    if attachments:
        return "prerouter"

    if "quota" in text.lower() or "Quota" in text:
        return "quota"

    if degraded:
        return "fallback"

    return "orchestrator"


class HttpProbe:
    """Envoie des questions via HTTP et mesure les latences."""

    def __init__(self, client: httpx.AsyncClient) -> None:
        self._client = client

    async def ask(
        self,
        question: str,
        context: dict[str, Any],
        persona: Persona,
    ) -> Exchange:
        """Envoie une question et retourne l'echange complet."""
        ts = datetime.now(tz=UTC).isoformat(timespec="milliseconds")

        # Choisir l'endpoint selon le tier
        if persona.is_guest:
            url = f"{BASE_URL}/chat/public"
            headers = {"Content-Type": "application/json"}
        else:
            url = f"{BASE_URL}/chat"
            headers = {
                "Content-Type": "application/json",
                **persona.auth_headers,
            }

        body = {"text": question, "context": context}

        t0 = time.perf_counter()
        try:
            resp = await self._client.post(url, json=body, headers=headers, timeout=30.0)
            latency = (time.perf_counter() - t0) * 1000

            if resp.status_code == 200:
                data = resp.json()
                return Exchange(
                    exchange_id="",  # sera rempli par le runner
                    ts_utc=ts,
                    wave="",
                    persona=persona.name,
                    persona_tier=persona.tier,
                    category="",
                    question=question,
                    context=context,
                    fixture_ref=None,
                    response_text=data.get("text", ""),
                    attachments=data.get("attachments", []),
                    suggested_actions=data.get("suggested_actions", []),
                    degraded=data.get("degraded", False),
                    freshness=data.get("freshness"),
                    latency_ms=round(latency, 1),
                    http_status=resp.status_code,
                    route=classify_route(data),
                )
            elif resp.status_code == 401:
                # Fallback vers /chat/public si auth echoue
                logger.warning(
                    "auth failed for %s (401), falling back to /chat/public",
                    persona.name,
                )
                resp2 = await self._client.post(
                    f"{BASE_URL}/chat/public",
                    json=body,
                    timeout=30.0,
                )
                latency = (time.perf_counter() - t0) * 1000
                if resp2.status_code == 200:
                    data = resp2.json()
                    return Exchange(
                        exchange_id="",
                        ts_utc=ts,
                        wave="",
                        persona=persona.name,
                        persona_tier=persona.tier,
                        category="",
                        question=question,
                        context=context,
                        fixture_ref=None,
                        response_text=data.get("text", ""),
                        attachments=data.get("attachments", []),
                        suggested_actions=data.get("suggested_actions", []),
                        degraded=data.get("degraded", False),
                        freshness=data.get("freshness"),
                        latency_ms=round(latency, 1),
                        http_status=resp2.status_code,
                        route=classify_route(data),
                        error="auth_fallback_to_public",
                    )

            latency = (time.perf_counter() - t0) * 1000
            return Exchange(
                exchange_id="",
                ts_utc=ts,
                wave="",
                persona=persona.name,
                persona_tier=persona.tier,
                category="",
                question=question,
                context=context,
                fixture_ref=None,
                latency_ms=round(latency, 1),
                http_status=resp.status_code,
                error=f"HTTP {resp.status_code}: {resp.text[:200]}",
                route="error",
            )

        except Exception as exc:
            latency = (time.perf_counter() - t0) * 1000
            return Exchange(
                exchange_id="",
                ts_utc=ts,
                wave="",
                persona=persona.name,
                persona_tier=persona.tier,
                category="",
                question=question,
                context=context,
                fixture_ref=None,
                latency_ms=round(latency, 1),
                http_status=0,
                error=str(exc),
                route="error",
            )


async def run_wave(
    probe: HttpProbe,
    wave: WavePlan,
    personas: dict[str, Persona],
    raw_dir: Path,
    delay_between_questions: float = 1.0,
) -> list[Exchange]:
    """Execute une vague de questions et ecrit les echanges dans raw/."""
    exchanges: list[Exchange] = []
    raw_dir.mkdir(parents=True, exist_ok=True)

    logger.info("=== Wave %s: %s (%d questions) ===",
                wave.wave_id, wave.description, len(wave.questions))

    for spec in wave.questions:
        persona = personas.get(spec.persona)
        if persona is None:
            # Fallback guest
            persona = Persona(name=spec.persona, tier="guest")

        exchange = await probe.ask(spec.question, spec.context, persona)

        # Remplir les champs du spec
        exchange.exchange_id = spec.exchange_id
        exchange.wave = spec.wave
        exchange.category = spec.category
        exchange.fixture_ref = spec.fixture_ref

        exchanges.append(exchange)

        # Ecrire immediatement dans raw/
        exchange_path = raw_dir / f"{spec.exchange_id}.json"
        exchange_path.write_text(
            json.dumps(asdict(exchange), indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

        # Log
        text_preview = exchange.response_text[:60].replace("\n", " ")
        status_icon = "+" if not exchange.degraded and not exchange.error else "X"
        logger.info(
            "  [%s] %s | %s | %6.0fms | %s | %s",
            status_icon, spec.exchange_id, spec.category,
            exchange.latency_ms, exchange.route, text_preview,
        )

        # Delai pour ne pas saturer le rate limiter
        await asyncio.sleep(delay_between_questions)

    return exchanges


async def run_all_waves(
    plan: RunPlan,
    personas: dict[str, Persona],
    run_dir: Path,
    delay_between_questions: float = 1.0,
) -> list[Exchange]:
    """Execute toutes les vagues du plan."""
    raw_dir = run_dir / "raw"
    all_exchanges: list[Exchange] = []

    async with httpx.AsyncClient() as client:
        probe = HttpProbe(client)

        for wave in plan.waves:
            exchanges = await run_wave(
                probe, wave, personas, raw_dir,
                delay_between_questions=delay_between_questions,
            )
            all_exchanges.extend(exchanges)

    return all_exchanges


def export_metrics(exchanges: list[Exchange], metrics_dir: Path) -> None:
    """Exporte les metriques des echanges."""
    metrics_dir.mkdir(parents=True, exist_ok=True)

    # Latences
    latencies = [e.latency_ms for e in exchanges if e.latency_ms > 0]
    if latencies:
        latencies_sorted = sorted(latencies)
        n = len(latencies_sorted)
        latency_stats = {
            "count": n,
            "avg": round(sum(latencies) / n, 1),
            "p50": round(latencies_sorted[n // 2], 1),
            "p90": round(latencies_sorted[int(n * 0.9)], 1),
            "p95": round(latencies_sorted[int(n * 0.95)], 1),
            "max": round(max(latencies), 1),
            "min": round(min(latencies), 1),
        }
    else:
        latency_stats = {}

    # Routes
    route_counts: dict[str, int] = {}
    for e in exchanges:
        route_counts[e.route] = route_counts.get(e.route, 0) + 1

    # Erreurs
    errors = [{"exchange_id": e.exchange_id, "error": e.error} for e in exchanges if e.error]

    # Par categorie
    by_category: dict[str, dict[str, int]] = {}
    for e in exchanges:
        cat = e.category or "unknown"
        if cat not in by_category:
            by_category[cat] = {"total": 0, "ok": 0, "degraded": 0, "error": 0}
        by_category[cat]["total"] += 1
        if e.error:
            by_category[cat]["error"] += 1
        elif e.degraded:
            by_category[cat]["degraded"] += 1
        else:
            by_category[cat]["ok"] += 1

    metrics = {
        "generated_utc": datetime.now(tz=UTC).isoformat(),
        "total_exchanges": len(exchanges),
        "latency": latency_stats,
        "routes": route_counts,
        "errors": errors,
        "by_category": by_category,
    }

    (metrics_dir / "run_metrics.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
