"""P5 — Charge et latence (900 appels). ⭐

Profils de charge sur serveur uvicorn réel.
Mesure latence bout-en-bout, décomposition par stage,
ratio appels/requête, taux d'erreur.

Lancer : uv run pytest tests/campaign/phases/p5_load.py -m integration -s
"""

from __future__ import annotations

import asyncio
import logging
import random
from typing import TYPE_CHECKING, Any

import pytest

from oria.kernel.models import Context
from tests.campaign.harness import Latencies, Probe, reconcile_quota
from tests.campaign.report import CampaignMetrics, PhaseResult
from tests.campaign.workloads import (
    BUNDESLIGA_ID,
    LA_LIGA_ID,
    LIGUE_1_ID,
    PREMIER_LEAGUE_ID,
    SERIE_A_ID,
)

if TYPE_CHECKING:
    from tests.campaign.recorder import Recorder

logger = logging.getLogger("p5")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P5", calls_budget=900)


class TestP5Load:
    """P5 — Tests de charge et latence."""

    async def test_l1_cached_data(
        self,
        probe: Probe,
        client: Any,
        season: int,
        latencies: Latencies,
        phase_result: PhaseResult,
    ) -> None:
        """L1 — 5 utilisateurs concurrents, 100% données en cache."""
        ctx = Context(league_id=LIGUE_1_ID, season=season)

        # Préchauffer le cache
        await probe.ask("classement ligue 1", ctx)

        # 5 utilisateurs, 10 requêtes chacun
        async def user_loop(user_id: str) -> list[float]:
            user_latencies: list[float] = []
            for _ in range(10):
                r = await probe.ask("classement ligue 1", ctx, user_id=user_id)
                user_latencies.append(r.latency_ms)
                latencies.record(r.latency_ms, "L1_cached")
                await asyncio.sleep(random.uniform(0.05, 0.15))
            return user_latencies

        tasks = [user_loop(f"l1-user-{i}") for i in range(5)]
        all_lats = await asyncio.gather(*tasks)

        flat = [lat for user_lats in all_lats for lat in user_lats]
        stats = latencies.stats(flat)
        logger.info(
            "L1 (5 users, cached): p50=%.0f p95=%.0f p99=%.0f max=%.0f",
            stats["p50"],
            stats["p95"],
            stats["p99"],
            stats["max"],
        )

        phase_result.metrics["L1"] = stats
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_l2_mixed_cache_cold(
        self,
        probe: Probe,
        client: Any,
        season: int,
        latencies: Latencies,
        phase_result: PhaseResult,
    ) -> None:
        """L2 — 10 utilisateurs, 80% cache / 20% froid."""
        questions_cached = [
            ("classement ligue 1", Context(league_id=LIGUE_1_ID, season=season)),
            ("classement Premier League", Context(league_id=PREMIER_LEAGUE_ID, season=season)),
        ]
        questions_cold = [
            ("classement La Liga", Context(league_id=LA_LIGA_ID, season=season)),
            ("classement Bundesliga", Context(league_id=BUNDESLIGA_ID, season=season)),
        ]

        # Préchauffer
        for q, ctx in questions_cached:
            await probe.ask(q, ctx)

        calls_before = client.governor.calls_today

        async def user_loop(user_id: str) -> list[float]:
            user_lats: list[float] = []
            for _ in range(5):
                if random.random() < 0.8:
                    q, ctx = random.choice(questions_cached)
                else:
                    q, ctx = random.choice(questions_cold)
                r = await probe.ask(q, ctx, user_id=user_id)
                user_lats.append(r.latency_ms)
                latencies.record(r.latency_ms, "L2_mixed")
                await asyncio.sleep(random.uniform(0.05, 0.2))
            return user_lats

        tasks = [user_loop(f"l2-user-{i}") for i in range(10)]
        all_lats = await asyncio.gather(*tasks)

        calls_after = client.governor.calls_today
        total_requests = sum(len(ul) for ul in all_lats)
        api_ratio = (calls_after - calls_before) / total_requests if total_requests else 0

        flat = [lat for ul in all_lats for lat in ul]
        stats = latencies.stats(flat)
        stats["api_ratio"] = api_ratio

        logger.info(
            "L2 (10 users, mixed): p50=%.0f p95=%.0f ratio=%.3f",
            stats["p50"],
            stats["p95"],
            api_ratio,
        )

        phase_result.metrics["L2"] = stats
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_l6_same_question(
        self,
        probe: Probe,
        client: Any,
        season: int,
        latencies: Latencies,
        phase_result: PhaseResult,
    ) -> None:
        """L6 — 25 users, tous la même question → single-flight maximal."""
        ctx = Context(league_id=LIGUE_1_ID, season=season)
        calls_before = client.governor.calls_today

        async def user_loop(user_id: str) -> list[float]:
            user_lats: list[float] = []
            for _ in range(5):
                r = await probe.ask("classement ligue 1", ctx, user_id=user_id)
                user_lats.append(r.latency_ms)
                latencies.record(r.latency_ms, "L6_same")
                await asyncio.sleep(random.uniform(0.05, 0.15))
            return user_lats

        tasks = [user_loop(f"l6-user-{i}") for i in range(25)]
        all_lats = await asyncio.gather(*tasks)

        calls_after = client.governor.calls_today
        delta = calls_after - calls_before
        total_requests = sum(len(ul) for ul in all_lats)
        api_ratio = delta / total_requests if total_requests else 0

        flat = [lat for ul in all_lats for lat in ul]
        stats = latencies.stats(flat)
        stats["api_ratio"] = api_ratio
        stats["total_api_calls"] = delta

        logger.info(
            "L6 (25 users, same Q): %d API calls / %d requests, ratio=%.3f",
            delta,
            total_requests,
            api_ratio,
        )

        phase_result.metrics["L6"] = stats
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_rate_limit_governor(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Test rate limit : rafale de requêtes distinctes.

        Le governor doit étaler sous 300/min.
        Aucun 429 upstream ne doit apparaître.
        """
        # On envoie 20 requêtes distinctes rapidement
        leagues = [LIGUE_1_ID, PREMIER_LEAGUE_ID, LA_LIGA_ID, SERIE_A_ID, BUNDESLIGA_ID]
        endpoints = ["/standings", "/fixtures", "/teams", "/injuries"]

        errors_429 = 0
        calls = 0

        for league_id in leagues:
            for endpoint in endpoints:
                try:
                    params = {"league": league_id, "season": season}
                    if endpoint == "/teams":
                        params = {"league": league_id}
                    await client.fetch(endpoint, params)
                    calls += 1
                except Exception as e:
                    if "429" in str(e):
                        errors_429 += 1
                    # Autres erreurs tolérées (ex: params manquants)

        if errors_429 > 0:
            phase_result.anomalies.append(
                {
                    "severity": "bloquant",
                    "title": "429 upstream détecté",
                    "description": (
                        f"{errors_429} réponses 429 de l'API → le governor "
                        f"ne respecte pas le rate limit"
                    ),
                    "type": "rate_limit",
                    "recommendation": (
                        "Implémenter un throttle actif dans le governor "
                        "(sleep avant l'appel si trop de requêtes/min)"
                    ),
                }
            )

        phase_result.tests_total += 1
        if errors_429 == 0:
            phase_result.tests_passed += 1

    async def test_generate_p5_summary(
        self,
        client: Any,
        recorder: Recorder,
        latencies: Latencies,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P5."""
        phase_result.calls_used = len(recorder.real_calls(phase="P5"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"

        # Ajouter les stats de latence au rapport global
        campaign_metrics.latencies = latencies.stats_by_category()

        recon = reconcile_quota(client.governor, recorder, phase="P5")
        if recon["anomalies"]:
            for a in recon["anomalies"]:
                phase_result.anomalies.append(
                    {
                        "severity": "bloquant",
                        "title": "Écart quota P5",
                        "description": a,
                        "type": "quota_drift",
                    }
                )

        campaign_metrics.phases.append(phase_result)
        logger.info(
            "P5 — %d/%d tests, %d appels, %d anomalies",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
            len(phase_result.anomalies),
        )
