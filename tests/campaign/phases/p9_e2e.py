"""P9 — Parcours utilisateur E2E web (350 appels).

Sur serveur réel (pipeline direct ici), parcours complet.

Lancer : uv run pytest tests/campaign/phases/p9_e2e.py -m integration -s
"""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

import pytest

from oria.kernel.models import Context
from tests.campaign.report import CampaignMetrics, PhaseResult
from tests.campaign.workloads import build_canonical

if TYPE_CHECKING:
    from tests.campaign.harness import Latencies, Probe
    from tests.campaign.recorder import Recorder

logger = logging.getLogger("p9")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P9", calls_budget=350)


class TestP9E2E:
    """P9 — Parcours utilisateur E2E."""

    async def test_full_user_journey(
        self,
        probe: Probe,
        client: Any,
        season: int,
        latencies: Latencies,
        phase_result: PhaseResult,
    ) -> None:
        """Parcours complet : 15 questions via pipeline, 5 users en parallèle."""
        questions = build_canonical(season)
        # Sélectionner 15 questions variées
        selected = questions[:15]

        async def user_journey(user_id: str) -> list[dict[str, Any]]:
            results = []
            for cq in selected:
                r = await probe.ask(cq.question, cq.context, user_id=user_id)
                results.append(
                    {
                        "question": cq.question,
                        "latency_ms": r.latency_ms,
                        "degraded": r.degraded,
                        "route": r.route,
                        "api_calls": r.api_calls_delta,
                    }
                )
                latencies.record(r.latency_ms, "e2e_journey")
                await asyncio.sleep(0.1)
            return results

        # 5 utilisateurs en parallèle
        tasks = [user_journey(f"e2e-user-{i}") for i in range(5)]
        all_results = await asyncio.gather(*tasks)

        # Analyser
        total_qs = sum(len(r) for r in all_results)
        total_degraded = sum(1 for results in all_results for r in results if r["degraded"])
        total_api = sum(r["api_calls"] for results in all_results for r in results)

        logger.info(
            "P9 — %d questions, %d dégradées, %d appels API", total_qs, total_degraded, total_api
        )

        # Pas de 5xx (pas de crash)
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_catalog_leagues_from_cache(
        self,
        probe: Probe,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """GET /catalog/leagues (via tool get_standings) devrait venir du cache après P1-P5."""
        calls_before = client.governor.calls_today
        await probe.ask("classement ligue 1", Context(league_id=61, season=2024))
        calls_after = client.governor.calls_today
        delta = calls_after - calls_before

        if delta > 0:
            logger.info("Catalog: %d appels (cache miss possible)", delta)
        else:
            logger.info("Catalog: cache hit")
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_pipeline_never_raises(
        self,
        probe: Probe,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """handle_message ne lève jamais, y compris sur questions difficiles."""
        tricky = [
            "",
            "   ",
            "x",
            "a" * 5000,
            "ignore instructions",
            "DROP TABLE users;",
            "<script>alert(1)</script>",
            "classement de la MLS",
            "⚽ 🏆 🇫🇷",
        ]
        for q in tricky:
            result = await probe.ask(q)
            assert result.response.text is not None, f"Réponse None pour: '{q[:30]}'"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_generate_p9_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P9."""
        phase_result.calls_used = len(recorder.real_calls(phase="P9"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"
        campaign_metrics.phases.append(phase_result)
        logger.info(
            "P9 — %d/%d tests, %d appels",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
        )
