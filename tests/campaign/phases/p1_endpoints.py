"""P1 — Conformité endpoint par endpoint (250 appels).

Pour chaque endpoint du catalogue :
1. Appel nominal avec paramètres valides
2. Vérification structure (errors vide, results > 0, paging cohérent)
3. Passage au mapper correspondant
4. Cas dégénérés (id inexistant, date sans match, param manquant)
5. Negative cache : même appel dégénéré répété ne repart pas

Lancer : uv run pytest tests/campaign/phases/p1_endpoints.py -m integration -s
"""

from __future__ import annotations

import logging
from typing import Any

import pytest

from oria.providers.apifootball.mapper import (
    map_fixtures,
    map_head2head,
    map_injuries,
    map_leagues,
    map_odds,
    map_players,
    map_standings,
    map_team_statistics,
    map_teams,
    map_top_assists,
    map_top_scorers,
)
from tests.campaign.harness import Latencies, reconcile_quota
from tests.campaign.recorder import Recorder
from tests.campaign.report import CampaignMetrics, PhaseResult

logger = logging.getLogger("p1")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

# IDs de test (Ligue 1 / PSG)
LIGUE_1 = 61
PSG = 85
OM = 81


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P1", calls_budget=250)


class TestP1Endpoints:
    """P1 — Conformité endpoint par endpoint."""

    async def test_fixtures_nominal(
        self,
        client: Any,
        season: int,
        recorder: Recorder,
        latencies: Latencies,
        phase_result: PhaseResult,
    ) -> None:
        """4.1 /fixtures — appel nominal."""
        raw = await client.fetch("/fixtures", {"league": LIGUE_1, "season": season, "last": 5})
        assert raw.get("errors") in ([], {}, None), f"Erreurs API: {raw.get('errors')}"

        # Si la saison courante n'a pas encore de matchs joués, fallback season-1
        if raw.get("results", 0) == 0:
            logger.info("Aucun fixture last=5 pour saison %d, fallback %d", season, season - 1)
            raw = await client.fetch("/fixtures", {"league": LIGUE_1, "season": season - 1, "last": 5})

        assert raw.get("results", 0) > 0, "Aucun résultat même avec fallback saison-1"
        mapped = map_fixtures(raw)
        assert len(mapped) > 0, "Mapper vide"
        assert mapped[0].get("id") is not None
        assert mapped[0].get("date") is not None
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_fixtures_by_team(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """/fixtures?team=85 — l'équipe apparaît en home ou away."""
        raw = await client.fetch("/fixtures", {"team": PSG, "season": season, "last": 3})
        mapped = map_fixtures(raw)
        for fix in mapped:
            home_id = fix.get("home", {}).get("id")
            away_id = fix.get("away", {}).get("id")
            assert home_id == PSG or away_id == PSG, (
                f"Fixture {fix.get('id')} ne contient pas le PSG (home={home_id}, away={away_id})"
            )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_fixtures_degenerate(
        self,
        client: Any,
        season: int,
        recorder: Recorder,
        phase_result: PhaseResult,
    ) -> None:
        """/fixtures avec ID inexistant → results=0, negative cache armé."""
        raw = await client.fetch("/fixtures", {"team": 99999999, "season": season})
        assert raw.get("results", -1) == 0
        phase_result.tests_total += 1

        # Deuxième appel identique → ne doit PAS partir vers l'API (negative cache)
        calls_before = client.governor.calls_today
        await client.fetch("/fixtures", {"team": 99999999, "season": season})
        calls_after = client.governor.calls_today
        assert calls_after == calls_before, (
            f"Negative cache non fonctionnel: {calls_after - calls_before} appels supplémentaires"
        )
        phase_result.tests_passed += 1

    async def test_standings_nominal(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """4.6 /standings — appel nominal."""
        raw = await client.fetch("/standings", {"league": LIGUE_1, "season": season})
        assert raw.get("results", 0) > 0
        mapped = map_standings(raw)
        assert len(mapped) > 0
        assert mapped[0].get("rank") is not None
        assert mapped[0].get("team", {}).get("name") is not None
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_teams_nominal(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """4.7 /teams — appel nominal."""
        raw = await client.fetch("/teams", {"id": PSG})
        assert raw.get("results", 0) > 0
        mapped = map_teams(raw)
        assert len(mapped) > 0
        assert mapped[0].get("id") == PSG
        assert mapped[0].get("name") is not None
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_teams_search(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """/teams?search=Paris — recherche textuelle."""
        raw = await client.fetch("/teams", {"search": "Paris"})
        assert raw.get("results", 0) > 0
        mapped = map_teams(raw)
        psg_found = any(t.get("id") == PSG for t in mapped)
        assert psg_found, "PSG non trouvé dans la recherche 'Paris'"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_teams_degenerate(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """/teams?id=99999999 — ID inexistant."""
        raw = await client.fetch("/teams", {"id": 99999999})
        assert raw.get("results", -1) == 0
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_team_statistics_nominal(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """4.8 /teams/statistics — stats saisonnières."""
        raw = await client.fetch(
            "/teams/statistics",
            {"league": LIGUE_1, "season": season, "team": PSG},
        )
        mapped = map_team_statistics(raw)
        assert mapped, "Stats d'équipe vides"
        assert mapped.get("team", {}).get("id") is not None
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_players_nominal(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """4.9 /players — stats joueurs (paginé)."""
        s = season
        raw = await client.fetch("/players", {"team": PSG, "season": s})
        if raw.get("results", 0) == 0:
            logger.info("Aucun joueur pour saison %d, fallback %d", s, s - 1)
            s = season - 1
            raw = await client.fetch("/players", {"team": PSG, "season": s})

        assert raw.get("results", 0) > 0, f"Aucun joueur même en saison {s}"
        mapped = map_players(raw)
        assert len(mapped) > 0
        assert mapped[0].get("name") is not None

        # Vérifier la pagination
        paging = raw.get("paging", {})
        assert paging.get("current") == 1
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_topscorers_nominal(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """4.10 /players/topscorers — top buteurs."""
        s = season
        raw = await client.fetch("/players/topscorers", {"league": LIGUE_1, "season": s})
        if raw.get("results", 0) == 0:
            logger.info("Aucun topscorer pour saison %d, fallback %d", s, s - 1)
            s = season - 1
            raw = await client.fetch("/players/topscorers", {"league": LIGUE_1, "season": s})

        assert raw.get("results", 0) > 0, f"Aucun topscorer même en saison {s}"
        mapped = map_top_scorers(raw)
        assert len(mapped) > 0
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_topassists_nominal(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """4.11 /players/topassists — top passeurs."""
        s = season
        raw = await client.fetch("/players/topassists", {"league": LIGUE_1, "season": s})
        if raw.get("results", 0) == 0:
            logger.info("Aucun topassist pour saison %d, fallback %d", s, s - 1)
            s = season - 1
            raw = await client.fetch("/players/topassists", {"league": LIGUE_1, "season": s})

        assert raw.get("results", 0) > 0, f"Aucun topassist même en saison {s}"
        mapped = map_top_assists(raw)
        assert len(mapped) > 0
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_injuries_nominal(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """4.12 /injuries — blessures."""
        raw = await client.fetch(
            "/injuries",
            {"league": LIGUE_1, "season": season},
        )
        # Les blessures peuvent être vides si pas en cours de saison
        mapped = map_injuries(raw)
        assert isinstance(mapped, list)
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_odds_nominal(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """4.13 /odds — cotes pré-match."""
        raw = await client.fetch(
            "/odds",
            {"league": LIGUE_1, "season": season},
        )
        mapped = map_odds(raw)
        assert isinstance(mapped, list)
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_leagues_nominal(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """/leagues — liste des ligues."""
        raw = await client.fetch("/leagues", {"id": LIGUE_1})
        assert raw.get("results", 0) > 0
        mapped = map_leagues(raw)
        assert len(mapped) > 0
        assert mapped[0].get("id") == LIGUE_1
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_h2h_nominal(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """4.2 /fixtures/headtohead — confrontations directes."""
        raw = await client.fetch(
            "/fixtures/headtohead",
            {"h2h": f"{PSG}-{OM}", "last": 5},
        )
        assert raw.get("results", 0) > 0
        mapped = map_head2head(raw)
        assert len(mapped) > 0
        # Chaque match implique PSG et OM
        for fix in mapped:
            ids = {fix.get("home", {}).get("id"), fix.get("away", {}).get("id")}
            assert PSG in ids and OM in ids, f"H2H fixture {fix.get('id')} ne contient pas PSG+OM"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_h2h_symmetry(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """H2H symétrie : h2h=A-B et h2h=B-A → mêmes fixture ids."""
        raw_ab = await client.fetch(
            "/fixtures/headtohead",
            {"h2h": f"{PSG}-{OM}", "last": 5},
        )
        raw_ba = await client.fetch(
            "/fixtures/headtohead",
            {"h2h": f"{OM}-{PSG}", "last": 5},
        )
        ids_ab = {f.get("fixture", {}).get("id") for f in raw_ab.get("response", [])}
        ids_ba = {f.get("fixture", {}).get("id") for f in raw_ba.get("response", [])}
        assert ids_ab == ids_ba, f"H2H non symétrique: {ids_ab} vs {ids_ba}"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_negative_cache_standings(
        self,
        client: Any,
        phase_result: PhaseResult,
    ) -> None:
        """Negative cache sur standings avec ligue inexistante."""
        raw = await client.fetch("/standings", {"league": 99999, "season": 2024})
        assert raw.get("results", -1) == 0

        calls_before = client.governor.calls_today
        await client.fetch("/standings", {"league": 99999, "season": 2024})
        calls_after = client.governor.calls_today
        assert calls_after == calls_before, "Negative cache non fonctionnel sur standings"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_generate_p1_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Génère le résumé P1."""
        phase_result.calls_used = len(recorder.real_calls(phase="P1"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"

        # Réconciliation
        recon = reconcile_quota(client.governor, recorder, phase="P1")
        if recon["anomalies"]:
            for anomaly in recon["anomalies"]:
                phase_result.anomalies.append(
                    {
                        "severity": "bloquant",
                        "title": "Écart quota",
                        "description": anomaly,
                        "type": "quota_drift",
                    }
                )

        campaign_metrics.phases.append(phase_result)

        logger.info("=" * 60)
        logger.info("P1 — RÉSUMÉ")
        logger.info("  Tests: %d/%d", phase_result.tests_passed, phase_result.tests_total)
        logger.info("  Appels API: %d/%d", phase_result.calls_used, phase_result.calls_budget)
        logger.info("  Anomalies: %d", len(phase_result.anomalies))
        logger.info("=" * 60)
