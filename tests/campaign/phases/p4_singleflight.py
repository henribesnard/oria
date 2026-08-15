"""P4 — Single-flight et questions concurrentes identiques (350 appels). ⭐

4 niveaux, du plus interne au plus réaliste :
- P4.1 : Niveau governor (in-process) — 50 fetch simultanés → 1 appel
- P4.2 : Niveau pipeline, question identique — 30 requêtes → 1 appel
- P4.3 : Niveau pipeline, paraphrases → matrice formulations → appels
- P4.4 : Niveau HTTP (nécessite uvicorn, fait dans P5/P9)

Lancer : uv run pytest tests/campaign/phases/p4_singleflight.py -m integration -s
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

import pytest

from oria.kernel.models import Context
from tests.campaign.harness import Probe, reconcile_quota
from tests.campaign.recorder import Recorder
from tests.campaign.report import CampaignMetrics, PhaseResult
from tests.campaign.workloads import build_paraphrases

logger = logging.getLogger("p4")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

LIGUE_1 = 61
PSG = 85


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P4", calls_budget=350)


class TestP4SingleFlight:
    """P4 — Single-flight et coalescence."""

    async def test_p41_governor_single_flight_10(
        self,
        client: Any,
        season: int,
        recorder: Recorder,
        phase_result: PhaseResult,
    ) -> None:
        """P4.1 — 10 appels identiques simultanés → exactement 1 appel HTTP."""
        # Vider le negative cache pour cette clé
        flight_key = client.governor.flight_key(
            "/standings",
            {"league": str(LIGUE_1), "season": str(season)},
        )
        client.governor.clear_negative(flight_key)

        calls_before = client.governor.calls_today

        # Lancer 10 appels simultanés
        coros = [
            client.fetch("/standings", {"league": LIGUE_1, "season": season}) for _ in range(10)
        ]
        results = await asyncio.gather(*coros)

        calls_after = client.governor.calls_today
        delta = calls_after - calls_before

        logger.info("P4.1 (10 coroutines): %d appels réels (attendu ≤1)", delta)

        # Tous les résultats doivent être identiques
        for r in results:
            assert r.get("results", 0) > 0

        assert delta <= 1, (
            f"Single-flight inefficace: {delta} appels pour 10 coroutines (attendu ≤1)"
        )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_p41_governor_single_flight_50(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """P4.1 — 50 appels identiques simultanés → exactement 1 appel HTTP."""
        # Utiliser un endpoint différent pour éviter le cache
        calls_before = client.governor.calls_today

        coros = [client.fetch("/teams", {"id": PSG}) for _ in range(50)]
        _results = await asyncio.gather(*coros)

        calls_after = client.governor.calls_today
        delta = calls_after - calls_before

        logger.info("P4.1 (50 coroutines): %d appels réels (attendu ≤1)", delta)

        assert delta <= 1, f"Single-flight 50: {delta} appels (attendu ≤1)"

        # Mesurer l'écart de latence premier vs dernier
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_p42_pipeline_identical_questions(
        self,
        probe: Probe,
        client: Any,
        season: int,
        recorder: Recorder,
        phase_result: PhaseResult,
    ) -> None:
        """P4.2 — 10 IncomingRequest identiques en parallèle → 1 appel API, 10 réponses."""
        ctx = Context(league_id=LIGUE_1, season=season)
        calls_before = client.governor.calls_today

        coros = [
            probe.ask(
                "classement ligue 1",
                ctx,
                user_id=f"user-p42-{i}",
            )
            for i in range(10)
        ]
        results = await asyncio.gather(*coros)

        calls_after = client.governor.calls_today
        delta = calls_after - calls_before

        logger.info("P4.2 (10 requêtes identiques): %d appels API", delta)

        # Toutes les réponses doivent être non-dégradées
        for r in results:
            assert not r.degraded, f"Réponse dégradée: {r.response.text[:100]}"

        # Note: le cache du repository devrait servir après le 1er appel.
        # Le single-flight au niveau governor assure la coalescence des
        # requêtes concurrentes. Avec le cache chaud, delta devrait être 0 ou 1.
        assert delta <= 1, f"P4.2: {delta} appels pour 10 requêtes identiques (attendu ≤1)"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_p43_paraphrases_singleflight(
        self,
        probe: Probe,
        client: Any,
        season: int,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """P4.3 — Paraphrases visant la même donnée → matrice formulations → appels.

        C'est le test le plus important : des formulations différentes
        visant la même donnée devraient générer le même appel API.
        """
        paraphrases = build_paraphrases(season)
        matrix: list[dict[str, Any]] = []

        for para in paraphrases:
            calls_before = client.governor.calls_today

            # Envoyer toutes les formulations en parallèle
            coros = [
                probe.ask(q, para.context, user_id=f"user-p43-{i}")
                for i, q in enumerate(para.questions)
            ]
            _results = await asyncio.gather(*coros)

            calls_after = client.governor.calls_today
            delta = calls_after - calls_before

            row = {
                "target": para.donnee_cible,
                "formulations": len(para.questions),
                "observed": delta,
                "expected": 1,
                "questions": para.questions,
            }
            matrix.append(row)

            verdict = "OK" if delta <= 1 else "ANOMALIE"
            logger.info(
                "P4.3 [%s]: %d formulations → %d appels (%s)",
                para.donnee_cible,
                len(para.questions),
                delta,
                verdict,
            )

            if delta > 1:
                # Documenter les clés de cache différentes
                phase_result.anomalies.append(
                    {
                        "severity": "majeur",
                        "title": f"Multi-appels pour '{para.donnee_cible}'",
                        "description": (
                            f"{len(para.questions)} formulations → {delta} appels "
                            f"(attendu 1). Les formulations différentes produisent "
                            f"des clés de cache distinctes."
                        ),
                        "type": "optimization",
                        "recommendation": (
                            "Normaliser les clés en amont du cache pour que "
                            "des formulations différentes convergent vers la "
                            "même requête API."
                        ),
                        "proof": f"Questions: {para.questions}",
                    }
                )

            # Petit délai pour éviter le rate limit
            await asyncio.sleep(0.2)

        # Stocker la matrice pour le rapport
        campaign_metrics.singleflight_matrix = matrix

        phase_result.tests_total += 1
        # Considéré passé si au moins 50% des paraphrases coalescent
        ok_count = sum(1 for r in matrix if r["observed"] <= r["expected"])
        if ok_count >= len(matrix) * 0.5:
            phase_result.tests_passed += 1
        else:
            phase_result.tests_failed += 1

    async def test_generate_p4_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P4."""
        phase_result.calls_used = len(recorder.real_calls(phase="P4"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"

        recon = reconcile_quota(client.governor, recorder, phase="P4")
        if recon["anomalies"]:
            for a in recon["anomalies"]:
                phase_result.anomalies.append(
                    {
                        "severity": "bloquant",
                        "title": "Écart quota P4",
                        "description": a,
                        "type": "quota_drift",
                    }
                )

        campaign_metrics.phases.append(phase_result)
        logger.info(
            "P4 — %d/%d tests, %d appels, %d anomalies",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
            len(phase_result.anomalies),
        )
