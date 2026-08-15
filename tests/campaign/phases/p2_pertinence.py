"""P2 — Pertinence et précision des données (250 appels).

Contrôles de cohérence croisés :
- Classement : rangs, points, goalsDiff
- Fixtures : dates, scores, équipe dans home/away
- Topscorers : buts décroissants
- Bout-en-bout : réponse Oria vs donnée brute API

Lancer : uv run pytest tests/campaign/phases/p2_pertinence.py -m integration -s
"""

from __future__ import annotations

import logging
from typing import Any

import pytest

from oria.kernel.models import Context
from oria.providers.apifootball.mapper import map_fixtures, map_standings, map_top_scorers
from tests.campaign.harness import Probe, reconcile_quota
from tests.campaign.recorder import Recorder
from tests.campaign.report import CampaignMetrics, PhaseResult

logger = logging.getLogger("p2")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

LIGUE_1 = 61
PSG = 85
OM = 81


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P2", calls_budget=250)


class TestP2Pertinence:
    """P2 — Contrôles de cohérence des données."""

    async def test_standings_ranks_complete(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Classement : rangs strictement 1..N sans trou."""
        raw = await client.fetch("/standings", {"league": LIGUE_1, "season": season})
        mapped = map_standings(raw)
        ranks = sorted(e.get("rank", 0) for e in mapped)
        expected = list(range(1, len(mapped) + 1))
        assert ranks == expected, f"Rangs non consécutifs: {ranks}"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_standings_points_formula(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Classement : points == 3*W + D."""
        raw = await client.fetch("/standings", {"league": LIGUE_1, "season": season})
        mapped = map_standings(raw)
        errors = []
        for entry in mapped:
            all_stats = entry.get("all", {})
            w = all_stats.get("win", 0) or 0
            d = all_stats.get("draw", 0) or 0
            pts = entry.get("points", 0) or 0
            expected_pts = 3 * w + d
            if pts != expected_pts:
                team_name = entry.get("team", {}).get("name", "?")
                errors.append(f"{team_name}: pts={pts} != 3*{w}+{d}={expected_pts}")
        assert not errors, "Formule points incorrecte:\n" + "\n".join(errors)
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_standings_played_formula(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Classement : played == W + D + L."""
        raw = await client.fetch("/standings", {"league": LIGUE_1, "season": season})
        mapped = map_standings(raw)
        errors = []
        for entry in mapped:
            all_stats = entry.get("all", {})
            w = all_stats.get("win", 0) or 0
            d = all_stats.get("draw", 0) or 0
            l_ = all_stats.get("lose", 0) or 0
            played = all_stats.get("played", 0) or 0
            if played != w + d + l_:
                team_name = entry.get("team", {}).get("name", "?")
                errors.append(f"{team_name}: played={played} != {w}+{d}+{l_}")
        assert not errors, "Formule played incorrecte:\n" + "\n".join(errors)
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_standings_goals_diff(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Classement : goalsDiff == for - against."""
        raw = await client.fetch("/standings", {"league": LIGUE_1, "season": season})
        mapped = map_standings(raw)
        errors = []
        for entry in mapped:
            all_stats = entry.get("all", {})
            goals = all_stats.get("goals", {})
            gf = goals.get("for", 0) or 0
            ga = goals.get("against", 0) or 0
            diff = entry.get("goals_diff", 0) or 0
            if diff != gf - ga:
                team_name = entry.get("team", {}).get("name", "?")
                errors.append(f"{team_name}: diff={diff} != {gf}-{ga}={gf - ga}")
        assert not errors, "goalsDiff incorrect:\n" + "\n".join(errors)
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_standings_even_matches(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Total de matchs joués par la ligue est pair."""
        raw = await client.fetch("/standings", {"league": LIGUE_1, "season": season})
        mapped = map_standings(raw)
        total_played = sum((e.get("all", {}).get("played", 0) or 0) for e in mapped)
        assert total_played % 2 == 0, f"Total matchs impair: {total_played}"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_fixtures_date_parsable(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Fixtures : date parsable en ISO."""
        from datetime import datetime

        raw = await client.fetch("/fixtures", {"league": LIGUE_1, "season": season, "last": 10})
        mapped = map_fixtures(raw)
        for fix in mapped:
            date_str = fix.get("date")
            assert date_str is not None, f"Date None pour fixture {fix.get('id')}"
            # Doit être parsable
            try:
                datetime.fromisoformat(date_str.replace("Z", "+00:00"))
            except (ValueError, TypeError) as e:
                pytest.fail(f"Date non parsable '{date_str}' pour fixture {fix.get('id')}: {e}")
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_fixtures_ft_has_score(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Fixtures FT : score non-None."""
        raw = await client.fetch("/fixtures", {"league": LIGUE_1, "season": season, "last": 10})
        mapped = map_fixtures(raw)
        for fix in mapped:
            status = fix.get("status", {})
            short = status.get("short", "")
            if short == "FT":
                assert fix.get("goals_home") is not None, (
                    f"Fixture FT {fix.get('id')} sans score home"
                )
                assert fix.get("goals_away") is not None, (
                    f"Fixture FT {fix.get('id')} sans score away"
                )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_fixtures_ns_no_score(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Fixtures NS : score None."""
        raw = await client.fetch("/fixtures", {"league": LIGUE_1, "season": season, "next": 5})
        mapped = map_fixtures(raw)
        for fix in mapped:
            status = fix.get("status", {})
            short = status.get("short", "")
            if short == "NS":
                assert fix.get("goals_home") is None, (
                    f"Fixture NS {fix.get('id')} a un score home: {fix.get('goals_home')}"
                )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_topscorers_descending(
        self,
        client: Any,
        season: int,
        phase_result: PhaseResult,
    ) -> None:
        """Topscorers : buts décroissants."""
        raw = await client.fetch(
            "/players/topscorers",
            {"league": LIGUE_1, "season": season},
        )
        mapped = map_top_scorers(raw)
        goals_list = []
        for p in mapped:
            stats = p.get("statistics", [])
            if stats:
                goals = stats[0].get("goals", {}).get("total", 0) or 0
                goals_list.append(goals)
        # Vérifier décroissance
        for i in range(len(goals_list) - 1):
            assert goals_list[i] >= goals_list[i + 1], (
                f"Buteurs non décroissants: {goals_list[i]} < {goals_list[i + 1]}"
            )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_e2e_standings_accuracy(
        self,
        client: Any,
        season: int,
        probe: Probe,
        phase_result: PhaseResult,
    ) -> None:
        """Bout-en-bout : réponse Oria vs donnée brute API (classement)."""
        # Donnée brute
        raw = await client.fetch("/standings", {"league": LIGUE_1, "season": season})
        mapped = map_standings(raw)
        leader_api = mapped[0] if mapped else None

        # Question Oria
        result = await probe.ask(
            "classement ligue 1",
            Context(league_id=LIGUE_1, season=season),
        )

        # Vérifier que le leader est dans la réponse
        if leader_api:
            leader_name = leader_api.get("team", {}).get("name", "")
            # Le leader doit apparaître dans les attachments ou le texte
            response_data = str(result.response.attachments) + result.response.text
            assert leader_name.lower() in response_data.lower() or not leader_name, (
                f"Leader {leader_name} absent de la réponse Oria"
            )
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_e2e_next_match(
        self,
        client: Any,
        season: int,
        probe: Probe,
        phase_result: PhaseResult,
    ) -> None:
        """Bout-en-bout : prochain match PSG."""
        result = await probe.ask(
            "prochain match du PSG",
            Context(team_id=PSG, league_id=LIGUE_1, season=season),
        )
        # Doit avoir une réponse non dégradée
        assert not result.degraded, f"Réponse dégradée: {result.response.text}"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_e2e_last_result(
        self,
        client: Any,
        season: int,
        probe: Probe,
        phase_result: PhaseResult,
    ) -> None:
        """Bout-en-bout : dernier résultat PSG."""
        result = await probe.ask(
            "dernier résultat du PSG",
            Context(team_id=PSG, league_id=LIGUE_1, season=season),
        )
        assert not result.degraded, f"Réponse dégradée: {result.response.text}"
        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_generate_p2_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P2."""
        phase_result.calls_used = len(recorder.real_calls(phase="P2"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"

        recon = reconcile_quota(client.governor, recorder, phase="P2")
        if recon["anomalies"]:
            for a in recon["anomalies"]:
                phase_result.anomalies.append(
                    {
                        "severity": "bloquant",
                        "title": "Écart quota P2",
                        "description": a,
                        "type": "quota_drift",
                    }
                )

        campaign_metrics.phases.append(phase_result)
        logger.info(
            "P2 — %d/%d tests, %d appels",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
        )
