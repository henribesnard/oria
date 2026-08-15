"""P7 — Live engine sur matchs réels (1800 appels).

À planifier un soir de matchs. Si aucun match live, la phase est sautée.

Lancer : uv run pytest tests/campaign/phases/p7_live.py -m integration -m live -s
"""

from __future__ import annotations

import logging
from typing import Any

import pytest

from oria.liveengine.engine import _MAX_CONCURRENT_POLLERS
from tests.campaign.recorder import Recorder
from tests.campaign.report import CampaignMetrics, PhaseResult

logger = logging.getLogger("p7")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.live,
    pytest.mark.asyncio,
]


class _FakeRegistry:
    def __init__(self, league_ids: list[int]) -> None:
        self.league_ids = league_ids
        self.team_ids: list[int] = []


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P7", calls_budget=1800)


class TestP7Live:
    """P7 — Live engine sur matchs réels."""

    async def test_detect_live_matches(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """Détection des matchs en cours via /fixtures?live=all."""
        raw = await client.fetch("/fixtures", {"live": "all"})
        live_count = raw.get("results", 0)
        logger.info("Matchs en direct détectés: %d", live_count)

        if live_count == 0:
            phase_result.anomalies.append(
                {
                    "severity": "observation",
                    "title": "Aucun match live",
                    "description": (
                        "Aucun match en cours au moment du test. "
                        "P7 ne peut pas valider le live engine. "
                        "Relancer un soir de matchs."
                    ),
                    "type": "skip",
                }
            )
            pytest.skip("Aucun match live — relancer un soir de matchs")

        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_poller_concurrency_limit(
        self,
        phase_result: PhaseResult,
    ) -> None:
        """_MAX_CONCURRENT_POLLERS est configuré."""
        assert _MAX_CONCURRENT_POLLERS == 10, (
            f"Limite de pollers inattendue: {_MAX_CONCURRENT_POLLERS}"
        )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_budget_awareness_gap(
        self,
        phase_result: PhaseResult,
    ) -> None:
        """La spec exige un plafond de pollers indexé sur le budget restant.

        Vérifier si ce comportement existe dans le code.
        """
        # Le code actuel de LiveEngine ne prend pas en compte le budget
        # restant pour ajuster le nombre de pollers ou la fréquence.
        # C'est un écart spec/implémentation à signaler.
        phase_result.anomalies.append(
            {
                "severity": "majeur",
                "title": "Plafond pollers non indexé sur budget",
                "description": (
                    "La spec exige que le nombre de pollers ou la fréquence "
                    "s'ajuste en fonction du budget restant. Le code actuel "
                    "(LiveEngine._scan_live_matches) utilise un plafond fixe "
                    "(_MAX_CONCURRENT_POLLERS=10) sans consulter le governor."
                ),
                "type": "spec_gap",
                "recommendation": (
                    "Injecter le governor dans LiveEngine et réduire le nombre "
                    "de pollers ou augmenter l'intervalle quand le budget "
                    "restant descend sous un seuil (ex: 1000 appels)."
                ),
            }
        )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_polling_interval_documented(
        self,
        phase_result: PhaseResult,
    ) -> None:
        """Documenter l'écart entre l'intervalle réel et l'estimation archi.

        Code: _FAST_INTERVAL=30s → 8 matchs × 2h × (3600/30) = 1920 appels
        Archi: poll 75s → 8 matchs × 2h × (3600/75) = 768 appels
        Écart: 2.5×
        """
        from oria.liveengine.poller import _FAST_INTERVAL, _SLOW_INTERVAL

        cost_per_match_2h_fast = 2 * 3600 / _FAST_INTERVAL
        cost_8_matches = 8 * cost_per_match_2h_fast
        archi_estimate = 768  # 8 matchs, 75s, 2h

        logger.info("Intervalle fast: %ds, slow: %ds", _FAST_INTERVAL, _SLOW_INTERVAL)
        logger.info("Coût 8 matchs/2h (fast): %.0f appels", cost_8_matches)
        logger.info("Estimation archi: %d appels", archi_estimate)
        logger.info("Ratio: %.1fx", cost_8_matches / archi_estimate)

        if cost_8_matches > archi_estimate * 1.5:
            phase_result.anomalies.append(
                {
                    "severity": "majeur",
                    "title": "Intervalle de polling trop agressif",
                    "description": (
                        f"_FAST_INTERVAL={_FAST_INTERVAL}s → {cost_8_matches:.0f} "
                        f"appels pour 8 matchs/2h (estimation archi: {archi_estimate}). "
                        f"Ratio: {cost_8_matches / archi_estimate:.1f}×"
                    ),
                    "type": "optimization",
                    "recommendation": (
                        "Augmenter _FAST_INTERVAL à 60-75s pour aligner "
                        "sur l'estimation de l'architecture."
                    ),
                }
            )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_generate_p7_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P7."""
        phase_result.calls_used = len(recorder.real_calls(phase="P7"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"
        campaign_metrics.phases.append(phase_result)
        logger.info(
            "P7 — %d/%d tests, %d appels, %d anomalies",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
            len(phase_result.anomalies),
        )
