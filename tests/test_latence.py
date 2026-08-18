"""Tests de LATENCE — chaque composant respecte ses seuils de temps.

Vérifie que :
- Le cache SQLite répond en < 5 ms
- Le governor ne rajoute pas de surcharge (< 1 ms)
- Le prerouter trivial (salutations) répond en < 10 ms
- Le pipeline complet avec cache hit < 50 ms
- Le pipeline fallback < 10 ms
- Le circuit breaker refuse instantanément quand ouvert
- Le negative cache court-circuite immédiatement
"""

from __future__ import annotations

import asyncio
import json
import time
from pathlib import Path
from typing import Any

import httpx
import pytest
import respx

from oria.config import Settings
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.synthesis import Synthesis
from oria.kernel.errors import CircuitOpenError
from oria.kernel.models import Context, IncomingRequest
from oria.kernel.resilience import CircuitBreaker
from oria.providers.apifootball.client import ApiFootballClient
from oria.providers.apifootball.governor import Governor
from oria.providers.apifootball.mapper import map_fixtures
from oria.storage.cache import Cache
from oria.storage.db import Database
from oria.tools.registry import ToolRegistry

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "apifootball"


def _load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES_DIR / name).read_text())


def _make_request(text: str, **ctx: Any) -> IncomingRequest:
    return IncomingRequest(
        user_id="test-user",
        text=text,
        context=Context(**ctx),
    )


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


class _Timer:
    """Chronomètre contextuel haute résolution."""

    def __init__(self) -> None:
        self.elapsed_ms: float = 0.0

    def __enter__(self) -> _Timer:
        self._start = time.perf_counter()
        return self

    def __exit__(self, *args: object) -> None:
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000


# ---------------------------------------------------------------------------
# CACHE LATENCE — SQLite en mémoire
# ---------------------------------------------------------------------------


class TestCacheLatence:
    """Le cache SQLite in-memory doit être ultra-rapide."""

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
    async def test_cache_write_sous_5ms(self, cache: Cache) -> None:
        """Écriture en cache < 5 ms."""
        data = [{"rank": i, "team": f"Team {i}"} for i in range(20)]
        with _Timer() as t:
            await cache.set("bench:write", data, domain="test")
        assert t.elapsed_ms < 5, f"cache write took {t.elapsed_ms:.2f} ms"

    @pytest.mark.asyncio
    async def test_cache_read_sous_5ms(self, cache: Cache) -> None:
        """Lecture en cache < 5 ms."""
        data = [{"rank": i, "team": f"Team {i}"} for i in range(20)]
        await cache.set("bench:read", data, domain="test")
        with _Timer() as t:
            entry = await cache.get("bench:read", domain="test")
        assert entry is not None
        assert t.elapsed_ms < 5, f"cache read took {t.elapsed_ms:.2f} ms"

    @pytest.mark.asyncio
    async def test_cache_miss_sous_2ms(self, cache: Cache) -> None:
        """Cache miss < 2 ms."""
        with _Timer() as t:
            entry = await cache.get("bench:miss", domain="test")
        assert entry is None
        assert t.elapsed_ms < 2, f"cache miss took {t.elapsed_ms:.2f} ms"

    @pytest.mark.asyncio
    async def test_cache_100_operations(self, cache: Cache) -> None:
        """100 lectures/écritures consécutives en < 200 ms."""
        with _Timer() as t:
            for i in range(50):
                await cache.set(f"bench:{i}", {"val": i}, domain="test")
            for i in range(50):
                await cache.get(f"bench:{i}", domain="test")
        assert t.elapsed_ms < 200, f"100 ops took {t.elapsed_ms:.2f} ms"


# ---------------------------------------------------------------------------
# GOVERNOR LATENCE — Surcharge minimale
# ---------------------------------------------------------------------------


class TestGovernorLatence:
    """Le governor ne doit pas ajouter de surcharge significative."""

    def test_check_budget_sous_01ms(self) -> None:
        """check_budget() < 0.1 ms."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        with _Timer() as t:
            for _ in range(1000):
                gov.check_budget()
        per_call = t.elapsed_ms / 1000
        assert per_call < 0.1, f"check_budget took {per_call:.4f} ms/call"

    def test_check_rate_sous_01ms(self) -> None:
        """check_rate() < 0.1 ms."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        with _Timer() as t:
            for _ in range(1000):
                gov.check_rate()
        per_call = t.elapsed_ms / 1000
        assert per_call < 0.1, f"check_rate took {per_call:.4f} ms/call"

    def test_flight_key_sous_01ms(self) -> None:
        """flight_key() < 0.1 ms."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        with _Timer() as t:
            for _ in range(1000):
                gov.flight_key("/fixtures", {"league": "61", "season": "2024"})
        per_call = t.elapsed_ms / 1000
        assert per_call < 0.1, f"flight_key took {per_call:.4f} ms/call"

    def test_negative_cache_check_sous_01ms(self) -> None:
        """is_negative_cached() < 0.1 ms."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        gov.set_negative("test-key")
        with _Timer() as t:
            for _ in range(1000):
                gov.is_negative_cached("test-key")
        per_call = t.elapsed_ms / 1000
        assert per_call < 0.1, f"negative check took {per_call:.4f} ms/call"

    def test_record_call_sous_01ms(self) -> None:
        """record_call() < 0.1 ms."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        with _Timer() as t:
            for _ in range(1000):
                gov.record_call()
        per_call = t.elapsed_ms / 1000
        assert per_call < 0.1, f"record_call took {per_call:.4f} ms/call"

    def test_snapshot_sous_1ms(self) -> None:
        """snapshot() < 1 ms."""
        gov = Governor(daily_budget=7500, rate_per_min=300)
        for _ in range(100):
            gov.record_call()
        with _Timer() as t:
            gov.snapshot()
        assert t.elapsed_ms < 1, f"snapshot took {t.elapsed_ms:.2f} ms"


# ---------------------------------------------------------------------------
# PREROUTER LATENCE — Réponse triviale rapide
# ---------------------------------------------------------------------------


class TestPreRouterLatence:
    """Le prerouter doit répondre quasi instantanément aux intentions triviales."""

    @pytest.fixture
    def prerouter(self) -> PreRouter:
        return PreRouter()

    @pytest.mark.asyncio
    async def test_salutation_sous_10ms(self, prerouter: PreRouter) -> None:
        """Une salutation est traitée en < 10 ms."""
        req = _make_request("Bonjour !")
        with _Timer() as t:
            result = await prerouter.try_route(req)
        assert result is not None
        assert t.elapsed_ms < 10, f"salutation took {t.elapsed_ms:.2f} ms"

    @pytest.mark.asyncio
    async def test_aide_sous_10ms(self, prerouter: PreRouter) -> None:
        req = _make_request("aide")
        with _Timer() as t:
            result = await prerouter.try_route(req)
        assert result is not None
        assert t.elapsed_ms < 10, f"aide took {t.elapsed_ms:.2f} ms"

    @pytest.mark.asyncio
    async def test_non_match_sous_5ms(self, prerouter: PreRouter) -> None:
        """Le rejet d'une question complexe est rapide aussi."""
        req = _make_request("Analyse la performance défensive du PSG cette saison")
        with _Timer() as t:
            result = await prerouter.try_route(req)
        assert result is None
        assert t.elapsed_ms < 5, f"non-match took {t.elapsed_ms:.2f} ms"


# ---------------------------------------------------------------------------
# PIPELINE LATENCE — Temps de bout en bout
# ---------------------------------------------------------------------------


class TestPipelineLatence:
    """Le pipeline doit répondre rapidement en cas de cache hit ou fallback."""

    @pytest.fixture
    def synthesis(self) -> Synthesis:
        return Synthesis()

    @pytest.mark.asyncio
    async def test_pipeline_fallback_sous_10ms(
        self, synthesis: Synthesis,
    ) -> None:
        """Le fallback pipeline (sans prerouter ni orchestrator) < 10 ms."""
        pipeline = Pipeline(synthesis=synthesis)
        req = _make_request("classement")
        with _Timer() as t:
            resp = await pipeline.handle_message(req)
        assert resp is not None
        assert t.elapsed_ms < 10, f"fallback took {t.elapsed_ms:.2f} ms"

    @pytest.mark.asyncio
    async def test_pipeline_salutation_sous_15ms(
        self, synthesis: Synthesis,
    ) -> None:
        """Salutation via prerouter dans le pipeline < 15 ms."""
        prerouter = PreRouter()
        pipeline = Pipeline(synthesis=synthesis, prerouter=prerouter)
        req = _make_request("Bonjour !")
        with _Timer() as t:
            resp = await pipeline.handle_message(req)
        assert "Oria" in resp.text
        assert t.elapsed_ms < 15, f"salutation pipeline took {t.elapsed_ms:.2f} ms"

    @pytest.mark.asyncio
    async def test_pipeline_prerouter_avec_cache_sous_50ms(
        self, synthesis: Synthesis,
    ) -> None:
        """Le prerouter avec tools mockés (simulant un cache hit) < 50 ms."""
        registry = ToolRegistry()

        async def fast_standings(**kwargs: Any) -> list[dict[str, Any]]:
            return [{"rank": 1, "team": {"name": "PSG"}, "points": 30}]

        registry.register(
            "get_standings", "Classements",
            {"type": "object", "properties": {}},
            fast_standings,
        )

        prerouter = PreRouter(tools=registry)
        pipeline = Pipeline(synthesis=synthesis, prerouter=prerouter)
        req = _make_request("classement", league_id=61, season=2024)
        with _Timer() as t:
            resp = await pipeline.handle_message(req)
        assert resp is not None
        assert t.elapsed_ms < 50, f"prerouter+cache took {t.elapsed_ms:.2f} ms"


# ---------------------------------------------------------------------------
# CIRCUIT BREAKER LATENCE — Refus instantané
# ---------------------------------------------------------------------------


class TestBreakerLatence:
    """Le circuit breaker ouvert doit refuser instantanément."""

    @pytest.mark.asyncio
    async def test_circuit_open_refus_sous_01ms(self) -> None:
        """Un breaker ouvert refuse en < 0.1 ms."""
        breaker = CircuitBreaker("bench-latence", fail_max=1, reset_timeout=3600)
        # Forcer l'ouverture
        try:
            async def _fail() -> None:
                raise RuntimeError("fail")

            await breaker.call(_fail)
        except RuntimeError:
            pass

        with _Timer() as t:
            for _ in range(1000):
                try:
                    async def _noop() -> None:
                        pass

                    await breaker.call(_noop)
                except CircuitOpenError:
                    pass
        per_call = t.elapsed_ms / 1000
        assert per_call < 0.1, f"open breaker took {per_call:.4f} ms/call"


# ---------------------------------------------------------------------------
# NEGATIVE CACHE LATENCE — Court-circuit immédiat
# ---------------------------------------------------------------------------


class TestNegativeCacheLatence:
    """Le negative cache doit court-circuiter sans appel HTTP."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_negative_cache_evite_appel_http(self) -> None:
        """Après un résultat vide, le 2ème appel ne touche pas le réseau."""
        raw = _load_fixture("empty_response.json")
        route = respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).respond(json=raw)

        client = ApiFootballClient(settings=_make_settings())
        await client.start()
        try:
            await client.fetch("/fixtures", {"league": "999"})

            with _Timer() as t:
                result = await client.fetch("/fixtures", {"league": "999"})
            assert result["results"] == 0
            assert route.call_count == 1  # un seul appel réseau
            assert t.elapsed_ms < 2, f"negative cache took {t.elapsed_ms:.2f} ms"
        finally:
            await client.stop()


# ---------------------------------------------------------------------------
# SINGLE-FLIGHT LATENCE — Coalescing efficace
# ---------------------------------------------------------------------------


class TestSingleFlightLatence:
    """Le single-flight ne doit pas ajouter de latence significative."""

    @respx.mock
    @pytest.mark.asyncio
    async def test_coalescing_pas_de_surcharge(self) -> None:
        """Le 2ème appel coalescé ne rajoute pas plus de 20 ms."""
        raw = _load_fixture("fixtures_response.json")

        async def _slow_response(request: httpx.Request) -> httpx.Response:
            await asyncio.sleep(0.05)  # 50 ms de "réseau"
            return httpx.Response(200, json=raw)

        respx.get(
            "https://v3.football.api-sports.io/fixtures",
        ).mock(side_effect=_slow_response)

        client = ApiFootballClient(settings=_make_settings())
        await client.start()
        try:
            start = time.perf_counter()
            results = await asyncio.gather(
                client.fetch("/fixtures", {"league": "61"}),
                client.fetch("/fixtures", {"league": "61"}),
            )
            total_ms = (time.perf_counter() - start) * 1000
            # Les deux doivent avoir le même résultat
            assert results[0]["results"] == results[1]["results"]
            # Doit être ~50 ms (une seule attente réseau), pas ~100 ms
            assert total_ms < 100, f"coalesced took {total_ms:.2f} ms (expected ~50)"
        finally:
            await client.stop()


# ---------------------------------------------------------------------------
# MAPPER LATENCE — Transformation rapide
# ---------------------------------------------------------------------------


class TestMapperLatence:
    """Les mappers doivent transformer le JSON rapidement."""

    def test_map_fixtures_sous_1ms(self) -> None:
        raw = _load_fixture("fixtures_response.json")
        with _Timer() as t:
            for _ in range(100):
                map_fixtures(raw)
        per_call = t.elapsed_ms / 100
        assert per_call < 1, f"map_fixtures took {per_call:.4f} ms"

    def test_map_standings_sous_1ms(self) -> None:
        raw = _load_fixture("standings_response.json")
        with _Timer() as t:
            for _ in range(100):
                from oria.providers.apifootball.mapper import map_standings
                map_standings(raw)
        per_call = t.elapsed_ms / 100
        assert per_call < 1, f"map_standings took {per_call:.4f} ms"

    def test_map_players_sous_1ms(self) -> None:
        raw = _load_fixture("players_response.json")
        with _Timer() as t:
            for _ in range(100):
                from oria.providers.apifootball.mapper import map_players
                map_players(raw)
        per_call = t.elapsed_ms / 100
        assert per_call < 1, f"map_players took {per_call:.4f} ms"

    def test_map_events_sous_1ms(self) -> None:
        raw = _load_fixture("events_response.json")
        with _Timer() as t:
            for _ in range(100):
                from oria.providers.apifootball.mapper import map_events
                map_events(raw)
        per_call = t.elapsed_ms / 100
        assert per_call < 1, f"map_events took {per_call:.4f} ms"


# ---------------------------------------------------------------------------
# SYNTHESIS LATENCE — Formatage rapide
# ---------------------------------------------------------------------------


class TestSynthesisLatence:
    """La synthèse doit formater les réponses rapidement."""

    @pytest.mark.asyncio
    async def test_render_sous_2ms(self) -> None:
        synthesis = Synthesis()
        with _Timer() as t:
            for _ in range(100):
                await synthesis.render("Test response")
        per_call = t.elapsed_ms / 100
        assert per_call < 2, f"render took {per_call:.4f} ms"

    @pytest.mark.asyncio
    async def test_fallback_sous_2ms(self) -> None:
        synthesis = Synthesis()
        with _Timer() as t:
            for _ in range(100):
                await synthesis.fallback()
        per_call = t.elapsed_ms / 100
        assert per_call < 2, f"fallback took {per_call:.4f} ms"

    @pytest.mark.asyncio
    async def test_quota_exceeded_sous_2ms(self) -> None:
        synthesis = Synthesis()
        with _Timer() as t:
            for _ in range(100):
                await synthesis.quota_exceeded("Limite atteinte")
        per_call = t.elapsed_ms / 100
        assert per_call < 2, f"quota_exceeded took {per_call:.4f} ms"
