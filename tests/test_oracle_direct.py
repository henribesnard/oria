"""Tests pour H-01 : oracle en appel direct API-Football.

Verifie que l'oracle interroge API-Football directement (hors cache ORIA)
et stocke des payloads bruts horodates.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, patch

import httpx
import pytest

from tests.matchday.oracle import (
    _AF_BASE_URL,
    _af_headers,
    collect_fixture_truth,
    collect_oracle,
    collect_standings_truth,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _af_fixture_response(fixture_id: int = 1234) -> dict[str, Any]:
    """Simule une reponse API-Football /fixtures."""
    return {
        "response": [{
            "fixture": {
                "id": fixture_id,
                "status": {"short": "FT", "elapsed": 90},
            },
            "goals": {"home": 2, "away": 1},
            "score": {
                "halftime": {"home": 1, "away": 0},
                "fulltime": {"home": 2, "away": 1},
                "extratime": {"home": None, "away": None},
                "penalty": {"home": None, "away": None},
            },
            "teams": {
                "home": {"id": 85, "name": "PSG"},
                "away": {"id": 81, "name": "Marseille"},
            },
        }],
    }


def _af_events_response() -> dict[str, Any]:
    return {
        "response": [
            {"type": "Goal", "team": {"id": 85}, "player": {"name": "Mbappe"}, "time": {"elapsed": 23}},
            {"type": "Card", "team": {"id": 81}, "player": {"name": "Payet"}, "time": {"elapsed": 45}},
        ],
    }


def _af_lineups_response() -> dict[str, Any]:
    return {
        "response": [
            {"team": {"id": 85, "name": "PSG"}, "formation": "4-3-3"},
            {"team": {"id": 81, "name": "Marseille"}, "formation": "3-5-2"},
        ],
    }


def _af_standings_response(league_id: int = 61) -> dict[str, Any]:
    return {
        "response": [{
            "league": {
                "id": league_id,
                "standings": [[
                    {"rank": 1, "team": {"id": 85, "name": "PSG"}, "points": 75},
                    {"rank": 2, "team": {"id": 81, "name": "Marseille"}, "points": 68},
                ]],
            },
        }],
    }


def _make_match(fixture_id: int = 1234, league_id: int = 61) -> dict[str, Any]:
    return {
        "fixture_id": fixture_id,
        "home_team": "PSG",
        "away_team": "Marseille",
        "score_home": 2,
        "score_away": 1,
        "status": "FT",
        "league_id": league_id,
        "league_name": "Ligue 1",
        "date": "2026-08-22",
        "round": "J1",
    }


# ---------------------------------------------------------------------------
# Tests _af_headers
# ---------------------------------------------------------------------------


class TestAfHeaders:
    def test_headers_use_env_key(self) -> None:
        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "test-key-abc"}):
            h = _af_headers()
            assert h == {"x-apisports-key": "test-key-abc"}

    def test_headers_raise_without_key(self) -> None:
        with patch.dict("os.environ", {}, clear=True):
            with pytest.raises(RuntimeError, match="APIFOOTBALL_KEY not set"):
                _af_headers()


# ---------------------------------------------------------------------------
# Tests collect_fixture_truth
# ---------------------------------------------------------------------------


class TestCollectFixtureTruth:
    @pytest.mark.asyncio
    async def test_collects_score_and_events(self) -> None:
        """La verite terrain contient score, events, lineups depuis API-Football."""
        responses = [
            httpx.Response(200, json=_af_fixture_response(1234)),
            httpx.Response(200, json=_af_events_response()),
            httpx.Response(200, json=_af_lineups_response()),
        ]
        transport = httpx.MockTransport(lambda req: responses.pop(0))

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k"}):
            async with httpx.AsyncClient(transport=transport) as client:
                truth = await collect_fixture_truth(client, 1234)

        assert truth["fixture_id"] == 1234
        assert truth["source"] == "api-football-direct"
        assert truth["collected_utc"]  # horodate

        # Score
        assert truth["fixture"]["status"] == "FT"
        assert truth["fixture"]["goals_home"] == 2
        assert truth["fixture"]["goals_away"] == 1
        assert truth["fixture"]["home"]["name"] == "PSG"

        # Events
        assert len(truth["events"]) == 2

        # Lineups
        assert truth["lineups_published"] is True
        assert len(truth["lineups"]) == 2

    @pytest.mark.asyncio
    async def test_handles_api_error_gracefully(self) -> None:
        """Si API-Football echoue, les erreurs sont loguees mais pas levees."""
        transport = httpx.MockTransport(
            lambda req: httpx.Response(500, text="Internal Server Error"),
        )

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k"}):
            async with httpx.AsyncClient(transport=transport) as client:
                truth = await collect_fixture_truth(client, 9999)

        assert truth["fixture_id"] == 9999
        assert "fixture_error" in truth

    @pytest.mark.asyncio
    async def test_source_is_api_football_direct(self) -> None:
        """Le champ source indique 'api-football-direct'."""
        responses = [
            httpx.Response(200, json=_af_fixture_response()),
            httpx.Response(200, json={"response": []}),
            httpx.Response(200, json={"response": []}),
        ]
        transport = httpx.MockTransport(lambda req: responses.pop(0))

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k"}):
            async with httpx.AsyncClient(transport=transport) as client:
                truth = await collect_fixture_truth(client, 1234)

        assert truth["source"] == "api-football-direct"


# ---------------------------------------------------------------------------
# Tests collect_standings_truth
# ---------------------------------------------------------------------------


class TestCollectStandingsTruth:
    @pytest.mark.asyncio
    async def test_collects_standings(self) -> None:
        transport = httpx.MockTransport(
            lambda req: httpx.Response(200, json=_af_standings_response(61)),
        )

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k"}):
            async with httpx.AsyncClient(transport=transport) as client:
                truth = await collect_standings_truth(client, 61, season=2025)

        assert truth["league_id"] == 61
        assert truth["season"] == 2025
        assert truth["source"] == "api-football-direct"
        assert truth["team_count"] == 2

    @pytest.mark.asyncio
    async def test_handles_empty_response(self) -> None:
        transport = httpx.MockTransport(
            lambda req: httpx.Response(200, json={"response": []}),
        )

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k"}):
            async with httpx.AsyncClient(transport=transport) as client:
                truth = await collect_standings_truth(client, 135)

        assert truth["standings"] == []
        assert truth["team_count"] == 0


# ---------------------------------------------------------------------------
# Tests collect_oracle
# ---------------------------------------------------------------------------


class TestCollectOracle:
    @pytest.mark.asyncio
    async def test_writes_fixtures_and_standings(self, tmp_path: Path) -> None:
        """collect_oracle ecrit fixtures.json et standings.json dans oracle/."""
        call_count = 0

        def mock_transport(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            url = str(request.url)
            if "fixtures/events" in url:
                return httpx.Response(200, json={"response": []})
            if "fixtures/lineups" in url:
                return httpx.Response(200, json={"response": []})
            if "fixtures" in url and "standings" not in url:
                return httpx.Response(200, json=_af_fixture_response())
            if "standings" in url:
                return httpx.Response(200, json=_af_standings_response())
            if "admin/quota" in url:
                return httpx.Response(200, json={"remaining": 7000})
            if "health" in url:
                return httpx.Response(200, json={"status": "UP"})
            return httpx.Response(404)

        oracle_dir = tmp_path / "oracle"
        match = _make_match()

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k", "ADMIN_BOOTSTRAP_TOKEN": "t"}):
            async with httpx.AsyncClient(transport=httpx.MockTransport(mock_transport)) as client:
                await collect_oracle(client, [match], oracle_dir)

        # fixtures.json
        fixtures_path = oracle_dir / "fixtures.json"
        assert fixtures_path.exists()
        fixtures_data = json.loads(fixtures_path.read_text(encoding="utf-8"))
        assert fixtures_data["source"] == "api-football-direct"
        assert len(fixtures_data["fixtures"]) == 1
        assert fixtures_data["fixtures"][0]["fixture_id"] == 1234

        # standings.json
        standings_path = oracle_dir / "standings.json"
        assert standings_path.exists()
        standings_data = json.loads(standings_path.read_text(encoding="utf-8"))
        assert standings_data["source"] == "api-football-direct"
        assert len(standings_data["leagues"]) == 1

    @pytest.mark.asyncio
    async def test_oracle_not_through_oria_cache(self, tmp_path: Path) -> None:
        """L'oracle appelle API-Football directement, pas le catalog ORIA."""
        urls_called: list[str] = []

        def mock_transport(request: httpx.Request) -> httpx.Response:
            urls_called.append(str(request.url))
            if "v3.football.api-sports.io" in str(request.url):
                return httpx.Response(200, json={"response": []})
            if "admin/quota" in str(request.url):
                return httpx.Response(200, json={"remaining": 7000})
            if "health" in str(request.url):
                return httpx.Response(200, json={"status": "UP"})
            return httpx.Response(200, json={})

        oracle_dir = tmp_path / "oracle"
        match = _make_match()

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k", "ADMIN_BOOTSTRAP_TOKEN": "t"}):
            async with httpx.AsyncClient(transport=httpx.MockTransport(mock_transport)) as client:
                await collect_oracle(client, [match], oracle_dir)

        # Verify API-Football was called directly
        af_calls = [u for u in urls_called if "api-sports.io" in u]
        assert len(af_calls) >= 1, "Oracle must call API-Football directly"

        # Verify ORIA catalog was NOT called
        catalog_calls = [u for u in urls_called if "catalog" in u]
        assert len(catalog_calls) == 0, "Oracle must NOT use ORIA catalog"

    @pytest.mark.asyncio
    async def test_each_fixture_has_timestamp(self, tmp_path: Path) -> None:
        """Chaque fixture dans l'oracle porte un horodatage collected_utc."""
        def mock_transport(request: httpx.Request) -> httpx.Response:
            if "api-sports.io" in str(request.url):
                return httpx.Response(200, json=_af_fixture_response())
            return httpx.Response(200, json={"response": []})

        oracle_dir = tmp_path / "oracle"
        matches = [_make_match(1234), _make_match(5678)]

        with patch.dict("os.environ", {"APIFOOTBALL_KEY": "k", "ADMIN_BOOTSTRAP_TOKEN": "t"}):
            async with httpx.AsyncClient(transport=httpx.MockTransport(mock_transport)) as client:
                await collect_oracle(client, matches, oracle_dir)

        data = json.loads((oracle_dir / "fixtures.json").read_text(encoding="utf-8"))
        for fix in data["fixtures"]:
            assert "collected_utc" in fix, "Each fixture must have collected_utc"
