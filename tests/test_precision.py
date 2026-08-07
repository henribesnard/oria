"""Tests de PRÉCISION — les données sont-elles exactes et fiables ?

Vérifie que :
- Les mappers extraient correctement chaque champ de la réponse API-Football
- Les repositories cache-first servent les bonnes données
- Le cache persiste et restitue fidèlement les valeurs
- Les données ne sont jamais altérées entre API → mapper → cache → tool → réponse
- Le governor compte précisément les appels et le budget
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from oria.config import Settings
from oria.providers.apifootball.client import ApiFootballClient
from oria.providers.apifootball.governor import Governor
from oria.providers.apifootball.mapper import (
    map_events,
    map_fixtures,
    map_injuries,
    map_lineups,
    map_odds,
    map_players,
    map_standings,
    map_statistics,
    map_team_statistics,
    map_teams,
)
from oria.storage.cache import Cache, CacheEntry, VOLATILITY_TTL
from oria.storage.db import Database

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "apifootball"


def _load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES_DIR / name).read_text())


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
        "apifootball_daily_budget": 7500,
        "apifootball_rate_per_min": 300,
    }
    defaults.update(overrides)
    return Settings(**defaults)


# ---------------------------------------------------------------------------
# MAPPER PRECISION — Chaque champ est vérifié
# ---------------------------------------------------------------------------


class TestMapperPrecision:
    """Chaque mapper extrait les données exactes du JSON brut."""

    def test_fixtures_champs_complets(self) -> None:
        raw = _load_fixture("fixtures_response.json")
        result = map_fixtures(raw)
        match = result[0]

        assert match["id"] == 1001
        assert match["referee"] == "M. Oliver"
        assert match["date"] == "2024-08-18T19:00:00+00:00"
        assert match["timestamp"] == 1724007600
        assert match["status"]["short"] == "FT"
        assert match["status"]["elapsed"] == 90
        assert match["venue"]["name"] == "Parc des Princes"
        assert match["venue"]["city"] == "Paris"
        assert match["league"]["id"] == 61
        assert match["league"]["name"] == "Ligue 1"
        assert match["league"]["country"] == "France"
        assert match["league"]["season"] == 2024
        assert match["league"]["round"] == "Regular Season - 1"
        assert match["home"]["id"] == 85
        assert match["home"]["name"] == "Paris Saint Germain"
        assert match["home"]["winner"] is True
        assert match["away"]["id"] == 79
        assert match["away"]["name"] == "Lille"
        assert match["away"]["winner"] is False
        assert match["goals_home"] == 2
        assert match["goals_away"] == 1
        assert match["score"]["halftime"]["home"] == 1
        assert match["score"]["fulltime"]["home"] == 2

    def test_fixtures_deuxieme_match(self) -> None:
        raw = _load_fixture("fixtures_response.json")
        result = map_fixtures(raw)
        match2 = result[1]

        assert match2["id"] == 1002
        assert match2["home"]["name"] == "Lyon"
        assert match2["away"]["name"] == "Monaco"
        assert match2["goals_home"] == 0
        assert match2["goals_away"] == 2
        assert match2["away"]["winner"] is True
        assert match2["home"]["winner"] is False

    def test_standings_precision(self) -> None:
        raw = _load_fixture("standings_response.json")
        result = map_standings(raw)

        psg = result[0]
        assert psg["rank"] == 1
        assert psg["team"]["name"] == "Paris Saint Germain"
        assert psg["team"]["id"] == 85
        assert psg["points"] == 30
        assert psg["goals_diff"] == 25
        assert psg["form"] == "WWWWW"
        assert psg["description"] == "Champions League"
        assert psg["all"]["played"] == 10
        assert psg["all"]["win"] == 10
        assert psg["all"]["goals"]["for"] == 30
        assert psg["all"]["goals"]["against"] == 5
        assert psg["home"]["played"] == 5
        assert psg["away"]["played"] == 5

        monaco = result[1]
        assert monaco["rank"] == 2
        assert monaco["team"]["name"] == "Monaco"
        assert monaco["points"] == 22
        assert monaco["form"] == "WWDWL"

    def test_teams_precision(self) -> None:
        raw = _load_fixture("teams_response.json")
        result = map_teams(raw)

        assert len(result) == 1
        team = result[0]
        assert team["id"] == 85
        assert team["name"] == "Paris Saint Germain"
        assert team["code"] == "PSG"
        assert team["country"] == "France"
        assert team["founded"] == 1970
        assert team["venue"]["name"] == "Parc des Princes"
        assert team["venue"]["city"] == "Paris"
        assert team["venue"]["capacity"] == 47929

    def test_players_precision(self) -> None:
        raw = _load_fixture("players_response.json")
        result = map_players(raw)

        assert len(result) == 1
        player = result[0]
        assert player["id"] == 276
        assert player["name"] == "K. Mbappe"
        assert player["firstname"] == "Kylian"
        assert player["lastname"] == "Mbappe"
        assert player["age"] == 25
        assert player["nationality"] == "France"
        assert len(player["statistics"]) == 1
        stats = player["statistics"][0]
        assert stats["goals"]["total"] == 10
        assert stats["goals"]["assists"] == 3

    def test_injuries_precision(self) -> None:
        raw = _load_fixture("injuries_response.json")
        result = map_injuries(raw)

        assert len(result) == 2
        inj = result[0]
        assert inj["player"]["name"] == "L. Hernandez"
        assert inj["team"]["name"] == "Paris Saint Germain"
        assert inj["league"]["id"] == 61

    def test_lineups_precision(self) -> None:
        raw = _load_fixture("lineups_response.json")
        result = map_lineups(raw)

        assert len(result) == 2
        psg = result[0]
        assert psg["team"]["name"] == "Paris Saint Germain"
        assert psg["formation"] == "4-3-3"
        assert psg["coach"]["name"] == "L. Enrique"
        assert len(psg["startXI"]) == 5  # tronqué dans la fixture
        assert psg["startXI"][0]["player"]["name"] == "G. Donnarumma"

    def test_odds_precision(self) -> None:
        raw = _load_fixture("odds_response.json")
        result = map_odds(raw)

        assert len(result) == 1
        odds = result[0]
        assert odds["fixture"]["id"] == 1001
        assert len(odds["bookmakers"]) == 1
        assert odds["bookmakers"][0]["name"] == "Bet365"
        bets = odds["bookmakers"][0]["bets"]
        assert bets[0]["name"] == "Match Winner"
        assert len(bets[0]["values"]) == 3

    def test_events_precision(self) -> None:
        raw = _load_fixture("events_response.json")
        result = map_events(raw)

        assert len(result) == 3
        goal1 = result[0]
        assert goal1["player"]["name"] == "K. Mbappe"
        assert goal1["time"]["elapsed"] == 23
        assert goal1["type"] == "Goal"
        assert goal1["assist"]["name"] == "A. Hakimi"

        goal3 = result[2]
        assert goal3["player"]["name"] == "O. Dembele"
        assert goal3["time"]["elapsed"] == 78

    def test_statistics_precision(self) -> None:
        raw = _load_fixture("statistics_response.json")
        result = map_statistics(raw)

        assert len(result) == 2
        psg_stats = result[0]
        assert psg_stats["team"]["name"] == "Paris Saint Germain"
        assert psg_stats["statistics"]["Shots on Goal"] == 8
        assert psg_stats["statistics"]["Ball Possession"] == "65%"
        assert psg_stats["statistics"]["expected_goals"] == "2.30"

        lille_stats = result[1]
        assert lille_stats["statistics"]["Total Shots"] == 9


# ---------------------------------------------------------------------------
# CACHE PRECISION — Les données sont restituées fidèlement
# ---------------------------------------------------------------------------


class TestCachePrecision:
    """Le cache persiste et restitue les données sans altération."""

    @pytest.fixture
    async def db(self) -> Database:
        database = Database(db_path=":memory:")
        await database.start()
        yield database
        await database.stop()

    @pytest.fixture
    async def cache(self, db: Database) -> Cache:
        c = Cache(db=db)
        await c.start()
        return c

    @pytest.mark.asyncio
    async def test_set_get_roundtrip(self, cache: Cache) -> None:
        """Les données survivent au roundtrip set → get."""
        original = [
            {"rank": 1, "team": {"name": "PSG"}, "points": 30},
            {"rank": 2, "team": {"name": "Monaco"}, "points": 22},
        ]
        await cache.set("standings:l61s2024", original, domain="standings")
        entry = await cache.get("standings:l61s2024", domain="standings")
        assert entry is not None
        assert entry.value == original

    @pytest.mark.asyncio
    async def test_nested_json_intact(self, cache: Cache) -> None:
        """Les structures JSON imbriquées sont préservées."""
        raw = _load_fixture("fixtures_response.json")
        fixtures = map_fixtures(raw)
        await cache.set("fixtures:l61", fixtures, domain="fixtures")
        entry = await cache.get("fixtures:l61", domain="fixtures")
        assert entry is not None
        assert entry.value == fixtures
        assert entry.value[0]["score"]["halftime"]["home"] == 1

    @pytest.mark.asyncio
    async def test_cache_freshness(self, cache: Cache) -> None:
        """Une entrée récente est fraîche, une ancienne ne l'est pas."""
        await cache.set("test:fresh", {"data": 1}, domain="test", volatility="lent")
        entry = await cache.get("test:fresh", domain="test")
        assert entry is not None
        assert entry.is_fresh is True

    @pytest.mark.asyncio
    async def test_cache_stale_allowed(self, cache: Cache) -> None:
        """Avec allow_stale=True, les données périmées sont retournées."""
        await cache.set("test:stale", {"data": 1}, domain="test", ttl_seconds=0.0)
        import asyncio
        await asyncio.sleep(0.01)
        entry = await cache.get("test:stale", domain="test", allow_stale=True)
        assert entry is not None
        assert entry.is_fresh is False
        assert entry.value == {"data": 1}

    @pytest.mark.asyncio
    async def test_cache_stale_denied(self, cache: Cache) -> None:
        """Avec allow_stale=False, les données périmées sont None."""
        await cache.set("test:deny", {"data": 1}, domain="test", ttl_seconds=0.0)
        import asyncio
        await asyncio.sleep(0.01)
        entry = await cache.get("test:deny", domain="test", allow_stale=False)
        assert entry is None

    @pytest.mark.asyncio
    async def test_cache_miss(self, cache: Cache) -> None:
        """Un cache miss retourne None."""
        entry = await cache.get("inexistant", domain="test")
        assert entry is None

    @pytest.mark.asyncio
    async def test_cache_overwrite(self, cache: Cache) -> None:
        """set() écrase les données précédentes."""
        await cache.set("test:over", {"v": 1}, domain="test")
        await cache.set("test:over", {"v": 2}, domain="test")
        entry = await cache.get("test:over", domain="test")
        assert entry is not None
        assert entry.value == {"v": 2}

    @pytest.mark.asyncio
    async def test_cache_delete(self, cache: Cache) -> None:
        """delete() supprime effectivement l'entrée."""
        await cache.set("test:del", {"v": 1}, domain="test")
        await cache.delete("test:del")
        entry = await cache.get("test:del", domain="test")
        assert entry is None

    def test_volatility_ttl_values(self) -> None:
        """Les TTL par volatilité sont cohérents."""
        assert VOLATILITY_TTL["immuable"] == 86400 * 30
        assert VOLATILITY_TTL["lent"] == 3600
        assert VOLATILITY_TTL["semi_rapide"] == 300
        assert VOLATILITY_TTL["live"] == 30

    def test_cache_entry_age_label(self) -> None:
        """Le label d'âge est lisible."""
        entry = CacheEntry(
            key="test",
            value={},
            domain="test",
            fetched_at=time.time() - 10,
            ttl_seconds=3600,
        )
        assert entry.age_label == "à l'instant"

        entry_old = CacheEntry(
            key="test",
            value={},
            domain="test",
            fetched_at=time.time() - 300,
            ttl_seconds=60,
        )
        assert "min" in entry_old.age_label


# ---------------------------------------------------------------------------
# GOVERNOR PRECISION — Comptage exact
# ---------------------------------------------------------------------------


class TestGovernorPrecision:
    """Le governor compte exactement les appels et gère le budget."""

    def test_budget_exact_7500(self) -> None:
        """Avec un plan Pro à 7500 appels/jour, le budget initial est exact."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        assert gov.remaining_budget == 7500
        assert gov.calls_today == 0

    def test_budget_decremente_un_par_un(self) -> None:
        gov = Governor(daily_budget=7500, rate_per_min=300)
        for i in range(10):
            gov.record_call()
        assert gov.calls_today == 10
        assert gov.remaining_budget == 7490

    def test_server_remaining_prioritaire(self) -> None:
        """Le budget serveur (header) est prioritaire sur le compteur local."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        gov.record_call()
        gov.record_call()
        # Le serveur dit qu'il reste 7400
        gov.update_from_headers({"x-ratelimit-requests-remaining": "7400"})
        assert gov.remaining_budget == 7400  # pas 7498

    def test_snapshot_precision(self) -> None:
        """Le snapshot reflète l'état exact."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        for _ in range(5):
            gov.record_call()
        snap = gov.snapshot()
        assert snap["daily_budget"] == 7500
        assert snap["calls_today"] == 5
        assert snap["remaining_budget"] == 7495
        assert snap["rate_per_min"] == 300
        assert snap["calls_this_minute"] == 5

    def test_flight_key_deterministe(self) -> None:
        """La clé de flight est déterministe et triée."""
        gov = Governor(daily_budget=100, rate_per_min=30)
        k1 = gov.flight_key("/fixtures", {"season": "2024", "league": "61"})
        k2 = gov.flight_key("/fixtures", {"league": "61", "season": "2024"})
        assert k1 == k2  # même clé malgré l'ordre différent

    def test_negative_cache_expire(self) -> None:
        """Le negative cache expire après le TTL."""
        gov = Governor(daily_budget=100, rate_per_min=30)
        gov.set_negative("test-key", ttl=0.01)
        import time as t
        t.sleep(0.02)
        assert not gov.is_negative_cached("test-key")


# ---------------------------------------------------------------------------
# REPOSITORY PRECISION — Cache-first avec données exactes
# ---------------------------------------------------------------------------


class TestRepositoryPrecision:
    """Les repositories cache-first restituent les données exactes."""

    @pytest.fixture
    async def db(self) -> Database:
        database = Database(db_path=":memory:")
        await database.start()
        yield database
        await database.stop()

    @pytest.fixture
    async def cache(self, db: Database) -> Cache:
        c = Cache(db=db)
        await c.start()
        return c

    @respx.mock
    @pytest.mark.asyncio
    async def test_fixtures_repo_precision(self, cache: Cache) -> None:
        """Le repo fixtures retourne les données exactes de l'API."""
        from oria.domain.fixtures import FixturesRepository

        raw = _load_fixture("fixtures_response.json")
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=_make_settings())
        await client.start()
        try:
            repo = FixturesRepository(cache=cache, client=client)
            result = await repo.get("league=61&season=2024")
            assert result is not None
            assert len(result) == 2
            assert result[0]["home"]["name"] == "Paris Saint Germain"
            assert result[0]["goals_home"] == 2
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_standings_repo_precision(self, cache: Cache) -> None:
        """Le repo standings retourne les données exactes."""
        from oria.domain.standings import StandingsRepository

        raw = _load_fixture("standings_response.json")
        respx.get(
            "https://v3.football.api-sports.io/standings",
        ).respond(json=raw)

        client = ApiFootballClient(settings=_make_settings())
        await client.start()
        try:
            repo = StandingsRepository(cache=cache, client=client)
            result = await repo.get("league=61&season=2024")
            assert result is not None
            assert result[0]["team"]["name"] == "Paris Saint Germain"
            assert result[0]["points"] == 30
            assert result[1]["team"]["name"] == "Monaco"
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_cache_first_sert_depuis_cache(self, cache: Cache) -> None:
        """Un 2ème appel est servi depuis le cache, pas l'API."""
        from oria.domain.fixtures import FixturesRepository

        raw = _load_fixture("fixtures_response.json")
        route = respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=_make_settings())
        await client.start()
        try:
            repo = FixturesRepository(cache=cache, client=client)
            r1 = await repo.get("league=61&season=2024")
            r2 = await repo.get("league=61&season=2024")
            assert r1 == r2
            # Un seul appel HTTP réel
            assert route.call_count == 1
        finally:
            await client.stop()


# ---------------------------------------------------------------------------
# CLIENT PRECISION — Headers et budget post-appel
# ---------------------------------------------------------------------------


class TestClientPrecision:
    """Le client API-Football met à jour le budget avec précision."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_budget_updated_from_response(self) -> None:
        """Le budget restant est mis à jour depuis les headers de réponse."""
        raw = _load_fixture("fixtures_response.json")
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(
            json=raw,
            headers={"x-ratelimit-requests-remaining": "7499"},
        )

        client = ApiFootballClient(settings=_make_settings())
        await client.start()
        try:
            await client.fetch("/fixtures", {"league": "61"})
            assert client.governor.remaining_budget == 7499
            assert client.governor.calls_today == 1
        finally:
            await client.stop()

    @respx.mock
    @pytest.mark.asyncio
    async def test_results_count_match_response(self) -> None:
        """Le champ results correspond au nombre d'éléments retournés."""
        raw = _load_fixture("fixtures_response.json")
        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=_make_settings())
        await client.start()
        try:
            data = await client.fetch("/fixtures", {"league": "61"})
            assert data["results"] == len(data["response"])
        finally:
            await client.stop()
