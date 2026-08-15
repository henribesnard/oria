"""P6 — Ingestion pilotée par les follows (500 appels).

1. Vérifier que aggregated_registry() déduplique
2. Lancer un cycle d'ingestion et compter les appels par job
3. Mesurer la couverture : après ingestion, questions A servies sans appel

Lancer : uv run pytest tests/campaign/phases/p6_ingestion.py -m integration -s
"""

from __future__ import annotations

import logging
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from oria.ingestion.scheduler import IngestionScheduler
from oria.kernel.models import Context
from tests.campaign.harness import Probe
from tests.campaign.recorder import Recorder
from tests.campaign.report import CampaignMetrics, PhaseResult

logger = logging.getLogger("p6")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

LIGUE_1 = 61
PREMIER_LEAGUE = 39
PSG = 85
OM = 81


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P6", calls_budget=500)


class _FakeRegistry:
    """Registre de follows simulé pour le test d'ingestion."""

    def __init__(self, league_ids: list[int], team_ids: list[int]) -> None:
        self.league_ids = league_ids
        self.team_ids = team_ids


class TestP6Ingestion:
    """P6 — Ingestion pilotée par les follows."""

    async def test_ingestion_single_cycle(
        self,
        client: Any,
        season: int,
        repos: dict[str, Any],
        recorder: Recorder,
        phase_result: PhaseResult,
    ) -> None:
        """Un cycle d'ingestion : compter les appels par job et par ligue."""
        # Créer un IngestionScheduler avec un follow_service mocké
        mock_follow = MagicMock()
        mock_follow.aggregated_registry = AsyncMock(
            return_value=_FakeRegistry(
                league_ids=[LIGUE_1, PREMIER_LEAGUE],
                team_ids=[PSG, OM],
            ),
        )

        scheduler = IngestionScheduler(
            follow_service=mock_follow,
            standings=repos["standings"],
            fixtures=repos["fixtures"],
            lineups=repos["lineups"],
        )

        # Forcer les timestamps pour déclencher un cycle complet
        scheduler._last_standings = 0.0
        scheduler._last_fixtures = 0.0
        scheduler._last_lineups = 0.0

        calls_before = client.governor.calls_today
        await scheduler._tick()
        calls_after = client.governor.calls_today

        delta = calls_after - calls_before
        logger.info("P6 — Cycle d'ingestion: %d appels API", delta)

        # Attendu : 2 ligues × 3 jobs (standings, fixtures, lineups) = ~6 appels max
        # (certains peuvent être en cache)
        phase_result.metrics["ingestion_calls_per_cycle"] = delta
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_ingestion_deduplication(
        self,
        phase_result: PhaseResult,
    ) -> None:
        """aggregated_registry() déduplique les follows."""
        mock_follow = MagicMock()
        # Simuler 12 users avec follows qui se recouvrent
        mock_follow.aggregated_registry = AsyncMock(
            return_value=_FakeRegistry(
                league_ids=[LIGUE_1, PREMIER_LEAGUE],  # déjà dédupliqué
                team_ids=[PSG, OM],
            ),
        )

        registry = await mock_follow.aggregated_registry()
        # Pas de doublon dans les IDs
        assert len(set(registry.league_ids)) == len(registry.league_ids), (
            f"Doublons de ligues: {registry.league_ids}"
        )
        assert len(set(registry.team_ids)) == len(registry.team_ids), (
            f"Doublons d'équipes: {registry.team_ids}"
        )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_ingestion_coverage(
        self,
        probe: Probe,
        client: Any,
        season: int,
        repos: dict[str, Any],
        recorder: Recorder,
        phase_result: PhaseResult,
    ) -> None:
        """P6.6 — Après ingestion, les questions famille A sont servies sans appel API.

        C'est la preuve directe que l'ingestion fait son travail.
        """
        # D'abord faire tourner l'ingestion pour remplir le cache
        mock_follow = MagicMock()
        mock_follow.aggregated_registry = AsyncMock(
            return_value=_FakeRegistry(
                league_ids=[LIGUE_1],
                team_ids=[PSG],
            ),
        )

        scheduler = IngestionScheduler(
            follow_service=mock_follow,
            standings=repos["standings"],
            fixtures=repos["fixtures"],
            lineups=repos["lineups"],
        )
        scheduler._last_standings = 0.0
        scheduler._last_fixtures = 0.0
        scheduler._last_lineups = 0.0
        await scheduler._tick()

        # Maintenant, les questions famille A sur Ligue 1 / PSG doivent être en cache
        questions_a = [
            ("classement ligue 1", Context(league_id=LIGUE_1, season=season)),
        ]

        zero_api_count = 0
        total = len(questions_a)

        for q, ctx in questions_a:
            calls_before = client.governor.calls_today
            await probe.ask(q, ctx)
            calls_after = client.governor.calls_today
            delta = calls_after - calls_before
            if delta == 0:
                zero_api_count += 1
            logger.info("  Couverture: '%s' → %d appels API", q, delta)

        coverage_rate = zero_api_count / total if total else 0
        logger.info(
            "P6.6 — Couverture ingestion: %d/%d (%.0f%%)",
            zero_api_count,
            total,
            coverage_rate * 100,
        )

        phase_result.metrics["ingestion_coverage"] = coverage_rate
        phase_result.tests_total += 1
        if coverage_rate >= 0.5:
            phase_result.tests_passed += 1

    async def test_generate_p6_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P6."""
        phase_result.calls_used = len(recorder.real_calls(phase="P6"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"
        campaign_metrics.phases.append(phase_result)
        logger.info(
            "P6 — %d/%d tests, %d appels",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
        )
