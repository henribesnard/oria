"""Fixtures partagées — fakes de modules."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from oria.config import Settings
from oria.container import Container
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.synthesis import Synthesis
from oria.kernel.events import EventBus
from oria.kernel.health import Availability, HealthRegistry, ModuleStatus
from oria.storage.cache import Cache
from oria.storage.db import Database

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

# ---------------------------------------------------------------------------
# Fake module générique
# ---------------------------------------------------------------------------


class FakeModule:
    """Module fake configurable pour les tests."""

    def __init__(
        self,
        name: str = "fake",
        *,
        required: bool = False,
        provides: tuple[str, ...] = (),
        fail_start: bool = False,
    ) -> None:
        self.name = name
        self.required = required
        self.provides = provides
        self._fail_start = fail_start
        self.started = False
        self.stopped = False

    async def start(self) -> None:
        if self._fail_start:
            raise RuntimeError(f"{self.name} start failed")
        self.started = True

    async def stop(self) -> None:
        self.stopped = True

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self.started else Availability.DOWN
        return ModuleStatus(name=self.name, availability=avail)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def settings() -> Settings:
    return Settings(
        apifootball_key="",
        deepseek_api_key="",
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        log_level="DEBUG",
        db_path=":memory:",
    )


@pytest.fixture
def health_registry() -> HealthRegistry:
    return HealthRegistry()


@pytest.fixture
def event_bus() -> EventBus:
    return EventBus()


@pytest.fixture
def container(settings: Settings) -> Container:
    return Container(settings=settings)


@pytest.fixture
async def db() -> AsyncIterator[Database]:
    database = Database(db_path=":memory:")
    await database.start()
    yield database
    await database.stop()


@pytest.fixture
async def cache(db: Database) -> Cache:
    c = Cache(db=db)
    await c.start()
    return c


@pytest.fixture
def synthesis() -> Synthesis:
    return Synthesis()


@pytest.fixture
def prerouter() -> PreRouter:
    return PreRouter()


@pytest.fixture
def pipeline(synthesis: Synthesis, prerouter: PreRouter) -> Pipeline:
    return Pipeline(synthesis=synthesis, prerouter=prerouter)
