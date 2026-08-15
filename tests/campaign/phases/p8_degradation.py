"""P8 — Dégradation, quota, breaker (250 appels).

Chaque scénario se termine par une réponse utilisateur exploitable.

Lancer : uv run pytest tests/campaign/phases/p8_degradation.py -m integration -s
"""

from __future__ import annotations

import logging
from typing import Any

import pytest

from oria.kernel.models import Context
from oria.kernel.resilience import get_breaker
from tests.campaign.harness import Probe, reconcile_quota
from tests.campaign.recorder import Recorder
from tests.campaign.report import CampaignMetrics, PhaseResult
from tests.campaign.workloads import build_adversarial

logger = logging.getLogger("p8")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

LIGUE_1 = 61
PSG = 85


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P8", calls_budget=250)


class TestP8Degradation:
    """P8 — Dégradation gracieuse."""

    async def test_adversarial_no_exception(
        self,
        probe: Probe,
        phase_result: PhaseResult,
    ) -> None:
        """Jeu ADVERSARIAL complet : aucune exception, réponses exploitables."""
        adversarial = build_adversarial()
        exceptions = []

        for adv in adversarial:
            try:
                result = await probe.ask(adv.question, adv.context)
                # La réponse doit être exploitable (texte non vide)
                assert result.response.text, f"Réponse vide pour: {adv.scenario}"
                logger.info(
                    "  [%s] '%s' → %s (degraded=%s)",
                    adv.scenario,
                    adv.question[:50],
                    result.route,
                    result.degraded,
                )
            except Exception as e:
                exceptions.append(f"{adv.scenario}: {e}")
                logger.error("  EXCEPTION [%s]: %s", adv.scenario, e)

        phase_result.tests_total += 1
        if not exceptions:
            phase_result.tests_passed += 1
        else:
            phase_result.anomalies.append(
                {
                    "severity": "bloquant",
                    "title": "Exceptions sur questions adversariales",
                    "description": f"{len(exceptions)} exceptions:\n" + "\n".join(exceptions),
                    "type": "robustness",
                }
            )

    async def test_hors_sujet_no_api_call(
        self,
        probe: Probe,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """Questions hors-sujet : 0 appel API."""
        hors_sujet = [
            "quelle est la météo aujourd'hui ?",
            "raconte-moi une blague",
            "quel est le sens de la vie ?",
        ]
        for q in hors_sujet:
            calls_before = client.governor.calls_today
            await probe.ask(q)
            calls_after = client.governor.calls_today
            delta = calls_after - calls_before
            if delta > 0:
                phase_result.anomalies.append(
                    {
                        "severity": "mineur",
                        "title": f"Appel API sur hors-sujet: '{q}'",
                        "description": f"{delta} appels API pour une question hors-sujet",
                        "type": "optimization",
                    }
                )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_empty_question(
        self,
        probe: Probe,
        phase_result: PhaseResult,
    ) -> None:
        """Question vide → réponse non-exception."""
        result = await probe.ask("")
        assert result.response.text, "Réponse vide pour question vide"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_very_long_question(
        self,
        probe: Probe,
        phase_result: PhaseResult,
    ) -> None:
        """Question de 10000 caractères → pas de crash."""
        result = await probe.ask("a" * 10000)
        assert result.response.text, "Réponse vide pour question longue"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_nonexistent_league(
        self,
        probe: Probe,
        phase_result: PhaseResult,
    ) -> None:
        """Ligue inexistante → réponse dégradée propre."""
        result = await probe.ask(
            "classement",
            Context(league_id=99999, season=2024),
        )
        # Ne doit pas crasher, réponse vide ou dégradée acceptable
        assert result.response.text is not None
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_breaker_state(
        self,
        phase_result: PhaseResult,
    ) -> None:
        """Le circuit breaker 'apifootball' doit être fermé."""
        breaker = get_breaker("apifootball")
        assert breaker.state == "closed", f"Breaker en état '{breaker.state}' — attendu 'closed'"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_quota_reconciliation(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
    ) -> None:
        """Réconciliation compteur local vs header serveur."""
        recon = reconcile_quota(client.governor, recorder)
        logger.info("Réconciliation: %s", recon)

        if recon["anomalies"]:
            for a in recon["anomalies"]:
                phase_result.anomalies.append(
                    {
                        "severity": "bloquant",
                        "title": "Écart quota global",
                        "description": a,
                        "type": "quota_drift",
                    }
                )
        phase_result.tests_total += 1
        if not recon["anomalies"]:
            phase_result.tests_passed += 1

    async def test_generate_p8_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P8."""
        phase_result.calls_used = len(recorder.real_calls(phase="P8"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"

        campaign_metrics.phases.append(phase_result)
        campaign_metrics.reconciliation = reconcile_quota(client.governor, recorder)

        logger.info(
            "P8 — %d/%d tests, %d appels, %d anomalies",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
            len(phase_result.anomalies),
        )
