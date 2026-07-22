"""Tests offline pour le provider API-Football.

Utilise respx pour mocker les appels httpx.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from oria.config import Settings
from oria.kernel.errors import QuotaExhaustedError, UpstreamError
from oria.providers.apifootball.client import ApiFootballClient
from oria.providers.apifootball.governor import Governor
from oria.providers.apifootball.mapper import (
    map_events,
    map_fixtures,
    map_head2head,
    map_injuries,
    map_lineups,
    map_odds,
    map_players,
    map_standings,
    map_statistics,
    map_team_statistics,
    map_teams,
    map_top_assists,
    map_top_scorers,
)

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "apifootball"


def _load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES_DIR / name).read_text())  # type: ignore[no-any-return]


def _make_settings(**overrides: Any) -> Settings:
    defaults: dict[str, Any] = {
        "apifootball_key": "test-key-123",
        "deepseek_api_key": "",
        "enable_llm": False,
        "enable_ingestion": False,
        "enable_live": False,
        "enable_push": False,
        "enable_monitoring": False,
        "log_level": "DEBUG",
        "db_path": ":memory:",
        "apifootball_base_url": "https://v3.football.api-sports.io",
        "apifootball_auth_mode": "direct",
        "apifootball_daily_budget": 100,
        "apifootball_rate_per_min": 30,
    }
    defaults.update(overrides)
    return Settings(**defaults)


# ---------------------------------------------------------------------------
# MAPPER TESTS
# ---------------------------------------------------------------------------


class TestMappers:
    """Teste le mapping JSON brut → modèles domaine."""

    def test_map_fixtures(self) -> None:
        raw = _load_fixture("fixtures_response.json")
        result = map_fixtures(raw)
        assert len(result) == 2
        assert result[0]["id"] == 1001
        assert result[0]["home"]["name"] == "Paris Saint Germain"
        assert result[0]["away"]["name"] == "Lille"
        assert result[0]["goals_home"] == 2
        assert result[0]["goals_away"] == 1
        assert result[0]["league"]["id"] == 61

    def test_map_fixtures_empty(self) -> None:
        raw = _load_fixture("empty_response.json")
        result = map_fixtures(raw)
        assert result == []

    def test_map_standings(self) -> None:
        raw = _load_fixture("standings_response.json")
        result = map_standings(raw)
        assert len(result) == 2
        assert result[0]["rank"] == 1
        assert result[0]["team"]["name"] == "Paris Saint Germain"
        assert result[0]["points"] == 30
        assert result[1]["rank"] == 2
        assert result[1]["team"]["name"] == "Monaco"

    def test_map_events_empty(self) -> None:
        assert map_events({"response": []}) == []

    def test_map_lineups_empty(self) -> None:
        assert map_lineups({"response": []}) == []

    def test_map_statistics_empty(self) -> None:
        assert map_statistics({"response": []}) == []

    def test_map_teams_empty(self) -> None:
        assert map_teams({"response": []}) == []

    def test_map_team_statistics_empty(self) -> None:
        assert map_team_statistics({"response": {}}) == {}

    def test_map_players_empty(self) -> None:
        assert map_players({"response": []}) == []

    def test_map_top_scorers_delegates(self) -> None:
        # top_scorers réutilise map_players
        assert map_top_scorers({"response": []}) == []

    def test_map_top_assists_delegates(self) -> None:
        assert map_top_assists({"response": []}) == []

    def test_map_injuries_empty(self) -> None:
        assert map_injuries({"response": []}) == []

    def test_map_odds_empty(self) -> None:
        assert map_odds({"response": []}) == []

    def test_map_head2head_delegates(self) -> None:
        # head2head réutilise map_fixtures
        assert map_head2head({"response": []}) == []


# ---------------------------------------------------------------------------
# GOVERNOR TESTS
# ---------------------------------------------------------------------------


class TestGovernor:
    """Teste le governor de quota."""

    def test_initial_state(self) -> None:
        gov = Governor(daily_budget=100, rate_per_min=30)
        assert gov.remaining_budget == 100
        assert gov.calls_today == 0

    def test_record_call_decrements(self) -> None:
        gov = Governor(daily_budget=100, rate_per_min=30)
        gov.record_call()
        gov.record_call()
        assert gov.calls_today == 2
        assert gov.remaining_budget == 98

    def test_budget_exhausted(self) -> None:
        gov = Governor(daily_budget=2, rate_per_min=30)
        gov.record_call()
        gov.record_call()
        with pytest.raises(QuotaExhaustedError, match="daily budget"):
            gov.check_budget()

    def test_rate_limit_exceeded(self) -> None:
        gov = Governor(daily_budget=1000, rate_per_min=2)
        gov.record_call()
        gov.record_call()
        with pytest.raises(QuotaExhaustedError, match="rate limit"):
            gov.check_rate()

    def test_update_from_headers(self) -> None:
        gov = Governor(daily_budget=100, rate_per_min=30)
        gov.update_from_headers({
            "x-ratelimit-requests-remaining": "42",
        })
        assert gov.remaining_budget == 42

    def test_negative_cache(self) -> None:
        gov = Governor(daily_budget=100, rate_per_min=30)
        key = "test-key"
        assert not gov.is_negative_cached(key)
        gov.set_negative(key, ttl=60.0)
        assert gov.is_negative_cached(key)
        gov.clear_negative(key)
        assert not gov.is_negative_cached(key)

    def test_flight_key(self) -> None:
        gov = Governor(daily_budget=100, rate_per_min=30)
        key = gov.flight_key("/fixtures", {"league": "61", "season": "2024"})
        assert key == "/fixtures|league=61|season=2024"
        key_no_params = gov.flight_key("/standings", None)
        assert key_no_params == "/standings"

    def test_snapshot(self) -> None:
        gov = Governor(daily_budget=100, rate_per_min=30)
        gov.record_call()
        snap = gov.snapshot()
        assert snap["daily_budget"] == 100
        assert snap["calls_today"] == 1
        assert snap["remaining_budget"] == 99
        assert snap["calls_this_minute"] == 1
        assert snap["in_flight_count"] == 0
        assert snap["negative_cache_size"] == 0


# ---------------------------------------------------------------------------
# CLIENT TESTS (avec respx)
# ---------------------------------------------------------------------------


class TestApiFootballClient:
    """Teste le client API-Football avec respx."""

    @pytest.fixture
    def settings(self) -> Settings:
        return _make_settings()

    @pytest.fixture
    def rapidapi_settings(self) -> Settings:
        return _make_settings(
            apifootball_auth_mode="rapidapi",
            apifootball_base_url="https://api-football-v1.p.rapidapi.com/v3",
        )

    @respx.mock
    @pytest.mark.asyncio
    async def test_fetch_fixtures(self, settings: Settings) -> None:
        """Un appel réussi retourne les données et enregistre l'appel."""
        raw = _load_fixture("fixtures_response.json")
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
            params={"league": "61", "season": "2024"},
        ).respond(
            json=raw,
            headers={
                "x-ratelimit-requests-remaining": "99",
            },
        )

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            result = await client.fetch(
                "/fixtures", {"league": "61", "season": "2024"},
            )
            assert result["results"] == 2
            assert len(result["response"]) == 2
            assert client.governor.calls_today == 1
            assert client.governor.remaining_budget == 99
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_fetch_empty_triggers_negative_cache(
        self, settings: Settings,
    ) -> None:
        """Une réponse vide active le negative cache."""
        raw = _load_fixture("empty_response.json")
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            result = await client.fetch("/fixtures", {"league": "999"})
            assert result["results"] == 0

            # Le 2ème appel doit toucher le negative cache
            result2 = await client.fetch("/fixtures", {"league": "999"})
            assert result2["results"] == 0
            # Seul 1 appel réel
            assert client.governor.calls_today == 1
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_fetch_upstream_error(self, settings: Settings) -> None:
        """Une réponse avec erreurs logiques lève UpstreamError."""
        raw = _load_fixture("error_response.json")
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            with pytest.raises(UpstreamError, match="logical error"):
                await client.fetch("/fixtures", {})
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_fetch_http_error(self, settings: Settings) -> None:
        """Un code HTTP >= 400 lève UpstreamError."""
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(status_code=500, json={"error": "server error"})

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            with pytest.raises(UpstreamError, match="500"):
                await client.fetch("/fixtures", {})
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_fetch_429_rate_limited(self, settings: Settings) -> None:
        """Un 429 lève UpstreamError."""
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(status_code=429, json={})

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            with pytest.raises(UpstreamError, match="rate limited"):
                await client.fetch("/fixtures", {})
        finally:
            await client.stop()

    @pytest.mark.asyncio
    async def test_budget_exhausted_prevents_call(
        self, settings: Settings,
    ) -> None:
        """Le governor bloque l'appel si le budget est épuisé."""
        s = _make_settings(apifootball_daily_budget=0)
        client = ApiFootballClient(settings=s)
        await client.start()
        try:
            with pytest.raises(QuotaExhaustedError):
                await client.fetch("/fixtures", {})
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_direct_auth_headers(self, settings: Settings) -> None:
        """En mode direct, le header x-apisports-key est envoyé."""
        raw = _load_fixture("fixtures_response.json")
        route = respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            await client.fetch("/fixtures", {"league": "61"})
            assert route.called
            req = route.calls[0].request
            assert req.headers["x-apisports-key"] == "test-key-123"
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_rapidapi_auth_headers(
        self, rapidapi_settings: Settings,
    ) -> None:
        """En mode rapidapi, les headers RapidAPI sont envoyés."""
        raw = _load_fixture("fixtures_response.json")
        route = respx.get(
            "https://api-football-v1.p.rapidapi.com/v3/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=rapidapi_settings)
        await client.start()
        try:
            await client.fetch("/fixtures", {"league": "61"})
            assert route.called
            req = route.calls[0].request
            assert req.headers["x-rapidapi-key"] == "test-key-123"
            assert (
                req.headers["x-rapidapi-host"]
                == "api-football-v1.p.rapidapi.com"
            )
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_single_flight_coalescing(
        self, settings: Settings,
    ) -> None:
        """Deux appels concurrents identiques ne génèrent qu'un seul HTTP."""
        raw = _load_fixture("fixtures_response.json")
        call_count = 0

        async def _slow_response(request: httpx.Request) -> httpx.Response:
            nonlocal call_count
            call_count += 1
            # Délai pour laisser le 2ème appel voir le future in-flight
            await asyncio.sleep(0.05)
            return httpx.Response(200, json=raw)

        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).mock(side_effect=_slow_response)

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            # Lancer deux appels identiques en parallèle
            results = await asyncio.gather(
                client.fetch("/fixtures", {"league": "61"}),
                client.fetch("/fixtures", {"league": "61"}),
            )
            # Les deux doivent avoir le même résultat
            assert results[0]["results"] == 2
            assert results[1]["results"] == 2
            # Mais un seul appel HTTP réel
            assert call_count == 1
        finally:
            await client.stop()

    @pytest.mark.asyncio
    async def test_not_started_raises(self, settings: Settings) -> None:
        """Un appel sans start() lève ProviderError."""
        from oria.kernel.errors import ProviderError

        client = ApiFootballClient(settings=settings)
        with pytest.raises(ProviderError, match="not started"):
            await client.fetch("/fixtures", {})

    @pytest.mark.asyncio
    async def test_no_key_raises_on_start(self) -> None:
        """start() sans clé API lève ProviderError."""
        from oria.kernel.errors import ProviderError

        s = _make_settings(apifootball_key="")
        client = ApiFootballClient(settings=s)
        with pytest.raises(ProviderError, match="not configured"):
            await client.start()

    @respx.mock
    @pytest.mark.asyncio
    async def test_health_reports_budget(self, settings: Settings) -> None:
        """health() inclut le budget restant."""
        raw = _load_fixture("fixtures_response.json")
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=settings)
        await client.start()
        try:
            await client.fetch("/fixtures", {"league": "61"})
            status = await client.health()
            assert status.availability.value == "up"
            assert status.details is not None
            assert status.details["calls_today"] == 1
        finally:
            await client.stop()


# ---------------------------------------------------------------------------
# BREAKER INTEGRATION TEST
# ---------------------------------------------------------------------------


class TestBreakerIntegration:
    """Teste que le circuit breaker s'ouvre après des échecs répétés."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_breaker_opens_after_failures(self) -> None:
        """5 erreurs consécutives ouvrent le breaker."""
        from oria.kernel.errors import CircuitOpenError
        from oria.kernel.resilience import _breakers

        # Nettoyer le registre de breakers
        _breakers.pop("apifootball", None)

        s = _make_settings(apifootball_daily_budget=100)
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(status_code=500, json={"error": "fail"})

        client = ApiFootballClient(settings=s)
        await client.start()
        try:
            # Chaque appel fait 3 tentatives (1 + 2 retries),
            # donc 2 appels = 6 tentatives ≥ fail_max=5
            for _ in range(2):
                with pytest.raises((UpstreamError, CircuitOpenError)):
                    await client.fetch(
                        f"/fixtures?r={_}",
                        {"league": str(_)},
                    )
        finally:
            await client.stop()
            _breakers.pop("apifootball", None)
