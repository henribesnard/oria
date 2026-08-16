"""Tests pour C-10 : résumé H2H pré-calculé."""

from __future__ import annotations

import pytest

from oria.tools.football import _h2h_summary


# ---------------------------------------------------------------------------
# Helpers — fixtures réalistes
# ---------------------------------------------------------------------------

def _fixture(
    home_id: int,
    away_id: int,
    goals_home: int,
    goals_away: int,
    *,
    home_name: str = "",
    away_name: str = "",
) -> dict:
    home_winner = goals_home > goals_away
    away_winner = goals_away > goals_home
    return {
        "home": {
            "id": home_id,
            "name": home_name or f"Team {home_id}",
            "winner": home_winner if not goals_home == goals_away else None,
        },
        "away": {
            "id": away_id,
            "name": away_name or f"Team {away_id}",
            "winner": away_winner if not goals_home == goals_away else None,
        },
        "goals_home": goals_home,
        "goals_away": goals_away,
    }


PSG_ID = 85
OM_ID = 81


# ---------------------------------------------------------------------------
# Tests _h2h_summary
# ---------------------------------------------------------------------------


class TestH2HSummary:
    """Tests unitaires pour la fonction _h2h_summary."""

    def test_empty_fixtures(self) -> None:
        result = _h2h_summary([], PSG_ID, OM_ID)
        assert result["total_matches"] == 0
        assert result["draws"] == 0
        assert result["team_1"]["wins"] == 0
        assert result["team_2"]["wins"] == 0

    def test_single_home_win_team1(self) -> None:
        """Team 1 gagne à domicile."""
        fixtures = [_fixture(PSG_ID, OM_ID, 3, 1, home_name="PSG", away_name="OM")]
        result = _h2h_summary(fixtures, PSG_ID, OM_ID)

        assert result["total_matches"] == 1
        assert result["team_1"]["id"] == PSG_ID
        assert result["team_1"]["name"] == "PSG"
        assert result["team_1"]["wins"] == 1
        assert result["team_1"]["goals"] == 3
        assert result["team_2"]["id"] == OM_ID
        assert result["team_2"]["name"] == "OM"
        assert result["team_2"]["wins"] == 0
        assert result["team_2"]["goals"] == 1
        assert result["draws"] == 0

    def test_single_away_win_team1(self) -> None:
        """Team 1 gagne à l'extérieur (team 2 est home)."""
        fixtures = [_fixture(OM_ID, PSG_ID, 0, 2, home_name="OM", away_name="PSG")]
        result = _h2h_summary(fixtures, PSG_ID, OM_ID)

        assert result["team_1"]["wins"] == 1
        assert result["team_1"]["goals"] == 2
        assert result["team_2"]["wins"] == 0
        assert result["team_2"]["goals"] == 0

    def test_draw(self) -> None:
        fixtures = [_fixture(PSG_ID, OM_ID, 1, 1, home_name="PSG", away_name="OM")]
        result = _h2h_summary(fixtures, PSG_ID, OM_ID)

        assert result["draws"] == 1
        assert result["team_1"]["wins"] == 0
        assert result["team_2"]["wins"] == 0
        assert result["team_1"]["goals"] == 1
        assert result["team_2"]["goals"] == 1

    def test_multiple_matches(self) -> None:
        """3 matchs : PSG gagne 2, OM gagne 1."""
        fixtures = [
            _fixture(PSG_ID, OM_ID, 3, 0, home_name="PSG", away_name="OM"),
            _fixture(OM_ID, PSG_ID, 2, 1, home_name="OM", away_name="PSG"),
            _fixture(PSG_ID, OM_ID, 2, 0, home_name="PSG", away_name="OM"),
        ]
        result = _h2h_summary(fixtures, PSG_ID, OM_ID)

        assert result["total_matches"] == 3
        assert result["team_1"]["wins"] == 2  # PSG wins
        assert result["team_2"]["wins"] == 1  # OM wins
        assert result["draws"] == 0
        assert result["team_1"]["goals"] == 3 + 1 + 2  # 6
        assert result["team_2"]["goals"] == 0 + 2 + 0  # 2

    def test_all_draws(self) -> None:
        fixtures = [
            _fixture(PSG_ID, OM_ID, 0, 0),
            _fixture(OM_ID, PSG_ID, 2, 2),
            _fixture(PSG_ID, OM_ID, 1, 1),
        ]
        result = _h2h_summary(fixtures, PSG_ID, OM_ID)

        assert result["total_matches"] == 3
        assert result["draws"] == 3
        assert result["team_1"]["wins"] == 0
        assert result["team_2"]["wins"] == 0
        assert result["team_1"]["goals"] == 0 + 2 + 1  # 3
        assert result["team_2"]["goals"] == 0 + 2 + 1  # 3

    def test_goals_none_treated_as_zero(self) -> None:
        """Si goals_home ou goals_away est None, on traite comme 0."""
        fixture = {
            "home": {"id": PSG_ID, "name": "PSG", "winner": None},
            "away": {"id": OM_ID, "name": "OM", "winner": None},
            "goals_home": None,
            "goals_away": None,
        }
        result = _h2h_summary([fixture], PSG_ID, OM_ID)
        assert result["team_1"]["goals"] == 0
        assert result["team_2"]["goals"] == 0
        assert result["draws"] == 1

    def test_symmetry(self) -> None:
        """Inverser team_id_1 et team_id_2 donne les mêmes stats, échangées."""
        fixtures = [
            _fixture(PSG_ID, OM_ID, 3, 1, home_name="PSG", away_name="OM"),
            _fixture(OM_ID, PSG_ID, 2, 0, home_name="OM", away_name="PSG"),
        ]
        r1 = _h2h_summary(fixtures, PSG_ID, OM_ID)
        r2 = _h2h_summary(fixtures, OM_ID, PSG_ID)

        assert r1["team_1"]["wins"] == r2["team_2"]["wins"]
        assert r1["team_2"]["wins"] == r2["team_1"]["wins"]
        assert r1["team_1"]["goals"] == r2["team_2"]["goals"]
        assert r1["team_2"]["goals"] == r2["team_1"]["goals"]
        assert r1["draws"] == r2["draws"]
        assert r1["total_matches"] == r2["total_matches"]

    def test_names_picked_from_first_occurrence(self) -> None:
        """Les noms sont extraits de la première fixture où chaque équipe apparaît."""
        fixtures = [
            _fixture(PSG_ID, OM_ID, 1, 0, home_name="Paris SG", away_name="Marseille"),
            _fixture(PSG_ID, OM_ID, 2, 1, home_name="PSG", away_name="OM"),
        ]
        result = _h2h_summary(fixtures, PSG_ID, OM_ID)
        assert result["team_1"]["name"] == "Paris SG"
        assert result["team_2"]["name"] == "Marseille"

    def test_unrelated_fixture_ignored(self) -> None:
        """Fixture où ni team_id_1 ni team_id_2 n'est home → ignorée pour wins/goals."""
        unrelated = {
            "home": {"id": 999, "name": "Other", "winner": True},
            "away": {"id": 998, "name": "Another", "winner": False},
            "goals_home": 5,
            "goals_away": 0,
        }
        result = _h2h_summary([unrelated], PSG_ID, OM_ID)
        # Match is counted in total but no wins/goals assigned
        assert result["total_matches"] == 1
        assert result["team_1"]["wins"] == 0
        assert result["team_2"]["wins"] == 0
        assert result["team_1"]["goals"] == 0
        assert result["team_2"]["goals"] == 0


# ---------------------------------------------------------------------------
# Tests get_h2h tool integration
# ---------------------------------------------------------------------------


class TestGetH2HTool:
    """Tests du tool get_h2h avec le résumé intégré."""

    @pytest.mark.asyncio
    async def test_h2h_returns_summary_and_fixtures(self) -> None:
        """get_h2h retourne summary + fixtures."""
        from unittest.mock import AsyncMock, MagicMock

        from oria.tools.registry import ToolRegistry

        registry = ToolRegistry()
        h2h_repo = AsyncMock()
        h2h_repo.get = AsyncMock(return_value=[
            _fixture(PSG_ID, OM_ID, 2, 1, home_name="PSG", away_name="OM"),
            _fixture(OM_ID, PSG_ID, 0, 0, home_name="OM", away_name="PSG"),
        ])

        # Build minimal kwargs for register_football_tools
        repos = {
            "fixtures": AsyncMock(),
            "standings": AsyncMock(),
            "teams": AsyncMock(),
            "players": AsyncMock(),
            "injuries": AsyncMock(),
            "lineups": AsyncMock(),
            "odds": AsyncMock(),
            "live": AsyncMock(),
            "events": AsyncMock(),
            "statistics": AsyncMock(),
            "head2head": h2h_repo,
            "team_statistics": AsyncMock(),
            "top_scorers": AsyncMock(),
            "top_assists": AsyncMock(),
        }

        from oria.tools.football import register_football_tools

        register_football_tools(registry, **repos)

        tool = registry.get("get_h2h")
        assert tool is not None

        result = await tool.fn(team_id_1=PSG_ID, team_id_2=OM_ID, last=5)

        assert "summary" in result
        assert "fixtures" in result
        assert result["summary"]["total_matches"] == 2
        assert result["summary"]["team_1"]["wins"] == 1  # PSG won match 1
        assert result["summary"]["draws"] == 1  # match 2 was 0-0

    @pytest.mark.asyncio
    async def test_h2h_empty_returns_empty(self) -> None:
        """get_h2h avec résultat vide retourne tel quel."""
        from unittest.mock import AsyncMock

        from oria.tools.registry import ToolRegistry

        registry = ToolRegistry()
        h2h_repo = AsyncMock()
        h2h_repo.get = AsyncMock(return_value=[])

        repos = {
            "fixtures": AsyncMock(),
            "standings": AsyncMock(),
            "teams": AsyncMock(),
            "players": AsyncMock(),
            "injuries": AsyncMock(),
            "lineups": AsyncMock(),
            "odds": AsyncMock(),
            "live": AsyncMock(),
            "events": AsyncMock(),
            "statistics": AsyncMock(),
            "head2head": h2h_repo,
            "team_statistics": AsyncMock(),
            "top_scorers": AsyncMock(),
            "top_assists": AsyncMock(),
        }

        from oria.tools.football import register_football_tools

        register_football_tools(registry, **repos)

        tool = registry.get("get_h2h")
        result = await tool.fn(team_id_1=PSG_ID, team_id_2=OM_ID)

        # Empty list returned as-is (no wrapping)
        assert result == []

    @pytest.mark.asyncio
    async def test_h2h_none_returns_none(self) -> None:
        """get_h2h avec None retourne None."""
        from unittest.mock import AsyncMock

        from oria.tools.registry import ToolRegistry

        registry = ToolRegistry()
        h2h_repo = AsyncMock()
        h2h_repo.get = AsyncMock(return_value=None)

        repos = {
            "fixtures": AsyncMock(),
            "standings": AsyncMock(),
            "teams": AsyncMock(),
            "players": AsyncMock(),
            "injuries": AsyncMock(),
            "lineups": AsyncMock(),
            "odds": AsyncMock(),
            "live": AsyncMock(),
            "events": AsyncMock(),
            "statistics": AsyncMock(),
            "head2head": h2h_repo,
            "team_statistics": AsyncMock(),
            "top_scorers": AsyncMock(),
            "top_assists": AsyncMock(),
        }

        from oria.tools.football import register_football_tools

        register_football_tools(registry, **repos)

        tool = registry.get("get_h2h")
        result = await tool.fn(team_id_1=PSG_ID, team_id_2=OM_ID)

        assert result is None
