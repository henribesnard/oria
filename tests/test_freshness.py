"""Tests C-03 — fraîcheur propagée de la couche data jusqu'à la Response."""

from __future__ import annotations

import time
from typing import Any
from unittest.mock import AsyncMock

import pytest

from oria.core.orchestrator import Orchestrator, OrchestratorResult
from oria.core.pipeline import Pipeline
from oria.core.synthesis import Synthesis
from oria.domain.base import BaseRepository
from oria.kernel.models import Context, IncomingRequest, Response
from oria.storage.cache import Cache, CacheEntry
from oria.tools.registry import ToolRegistry


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_req(text: str = "classement Ligue 1") -> IncomingRequest:
    return IncomingRequest(user_id="u1", text=text, context=Context())


class FakeCache:
    """Simule le cache avec un CacheEntry pré-configuré."""

    def __init__(self, *, fetched_at: float | None = None, fresh: bool = True) -> None:
        self._fetched_at = fetched_at
        self._fresh = fresh

    async def get(
        self, key: str, *, domain: str = "", allow_stale: bool = True,
    ) -> CacheEntry | None:
        if self._fetched_at is None:
            return None
        return CacheEntry(
            key=key,
            value={"data": "test"},
            domain=domain,
            fetched_at=self._fetched_at,
            ttl_seconds=3600 if self._fresh else 0,
        )

    async def set(self, *args: Any, **kwargs: Any) -> None:
        pass


class FakeProvider:
    """Simule le provider API pour les repos."""

    async def fetch(self, key: str) -> dict[str, Any]:
        return {"data": "fresh"}


# ---------------------------------------------------------------------------
# Tests ToolRegistry freshness tracking
# ---------------------------------------------------------------------------


class TestRegistryFreshness:
    """Le registre accumule le timestamp le plus ancien."""

    def test_reset_freshness(self) -> None:
        reg = ToolRegistry()
        reg.record_fetched_at(100.0)
        assert reg._oldest_fetched_at == 100.0
        reg.reset_freshness()
        assert reg._oldest_fetched_at is None

    def test_record_keeps_oldest(self) -> None:
        reg = ToolRegistry()
        reg.record_fetched_at(200.0)
        reg.record_fetched_at(100.0)
        reg.record_fetched_at(300.0)
        assert reg._oldest_fetched_at == 100.0

    def test_freshness_label_none_when_empty(self) -> None:
        reg = ToolRegistry()
        assert reg.freshness_label is None

    def test_freshness_label_instant(self) -> None:
        reg = ToolRegistry()
        reg.record_fetched_at(time.time() - 5)
        assert reg.freshness_label == "à l'instant"

    def test_freshness_label_minutes(self) -> None:
        reg = ToolRegistry()
        reg.record_fetched_at(time.time() - 180)  # 3 min ago
        label = reg.freshness_label
        assert label is not None
        assert "min" in label

    def test_freshness_label_hours(self) -> None:
        reg = ToolRegistry()
        reg.record_fetched_at(time.time() - 7200)  # 2h ago
        label = reg.freshness_label
        assert label is not None
        assert "h" in label

    def test_freshness_label_days(self) -> None:
        reg = ToolRegistry()
        reg.record_fetched_at(time.time() - 172800)  # 2 days ago
        label = reg.freshness_label
        assert label is not None
        assert "j" in label


# ---------------------------------------------------------------------------
# Tests BaseRepository last_fetched_at tracking
# ---------------------------------------------------------------------------


class TestBaseRepositoryFetchedAt:
    """Le repo expose last_fetched_at après un get()."""

    @pytest.mark.asyncio
    async def test_last_fetched_at_from_cache_hit(self) -> None:
        ts = time.time() - 120  # 2 min ago
        fake_cache = FakeCache(fetched_at=ts, fresh=True)
        repo = BaseRepository(cache=fake_cache, domain="test")  # type: ignore[arg-type]
        await repo.get("key")
        assert repo.last_fetched_at == ts
        assert repo.last_age_label is not None

    @pytest.mark.asyncio
    async def test_last_fetched_at_none_on_miss(self) -> None:
        fake_cache = FakeCache(fetched_at=None)
        repo = BaseRepository(cache=fake_cache, domain="test")  # type: ignore[arg-type]
        result = await repo.get("key")
        assert result is None
        assert repo.last_fetched_at is None


# ---------------------------------------------------------------------------
# Tests _get_and_track helper
# ---------------------------------------------------------------------------


class TestGetAndTrack:
    """_get_and_track propage la fraîcheur du repo vers le registre."""

    @pytest.mark.asyncio
    async def test_tracks_freshness(self) -> None:
        from oria.tools.football import _get_and_track

        ts = time.time() - 30
        fake_cache = FakeCache(fetched_at=ts, fresh=True)
        repo = BaseRepository(cache=fake_cache, domain="test")  # type: ignore[arg-type]
        reg = ToolRegistry()

        result = await _get_and_track(reg, repo, "key")
        assert result is not None
        assert reg._oldest_fetched_at == ts

    @pytest.mark.asyncio
    async def test_no_track_on_none(self) -> None:
        from oria.tools.football import _get_and_track

        fake_cache = FakeCache(fetched_at=None)
        repo = BaseRepository(cache=fake_cache, domain="test")  # type: ignore[arg-type]
        reg = ToolRegistry()

        result = await _get_and_track(reg, repo, "key")
        assert result is None
        assert reg._oldest_fetched_at is None


# ---------------------------------------------------------------------------
# Tests OrchestratorResult freshness field
# ---------------------------------------------------------------------------


class TestOrchestratorResultFreshness:
    """OrchestratorResult transporte le label de fraîcheur."""

    def test_default_none(self) -> None:
        r = OrchestratorResult(text="ok")
        assert r.freshness is None

    def test_with_freshness(self) -> None:
        r = OrchestratorResult(text="ok", freshness="il y a 3 min")
        assert r.freshness == "il y a 3 min"


# ---------------------------------------------------------------------------
# Tests pipeline freshness → synthesis.render
# ---------------------------------------------------------------------------


class TestPipelineFreshnessToSynthesis:
    """La pipeline transmet la fraîcheur de l'orchestrateur à la synthèse."""

    @pytest.mark.asyncio
    async def test_freshness_passed_to_render(self) -> None:
        synthesis = Synthesis()
        orch = AsyncMock(spec=Orchestrator)
        orch.run.return_value = OrchestratorResult(
            text="PSG est premier",
            freshness="il y a 5 min",
        )

        pipeline = Pipeline(synthesis=synthesis, orchestrator=orch)
        req = _make_req()
        resp = await pipeline.handle_message(req)

        assert resp.freshness == "il y a 5 min"
        assert resp.text == "PSG est premier"

    @pytest.mark.asyncio
    async def test_no_freshness_when_none(self) -> None:
        synthesis = Synthesis()
        orch = AsyncMock(spec=Orchestrator)
        orch.run.return_value = OrchestratorResult(text="Salut")

        pipeline = Pipeline(synthesis=synthesis, orchestrator=orch)
        req = _make_req("salut")
        resp = await pipeline.handle_message(req)

        assert resp.freshness is None

    @pytest.mark.asyncio
    async def test_freshness_with_degraded(self) -> None:
        synthesis = Synthesis()
        orch = AsyncMock(spec=Orchestrator)
        orch.run.return_value = OrchestratorResult(
            text="Données partielles",
            degraded=True,
            freshness="il y a 2 h",
        )

        pipeline = Pipeline(synthesis=synthesis, orchestrator=orch)
        req = _make_req()
        resp = await pipeline.handle_message(req)

        assert resp.freshness == "il y a 2 h"
        assert resp.degraded is True
