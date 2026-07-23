"""Ingestion — pré-fetch programmé piloté par les follows."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import TYPE_CHECKING

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.preferences.service import FollowService
    from oria.domain.fixtures import FixturesRepository
    from oria.domain.lineups import LineupsRepository
    from oria.domain.standings import StandingsRepository
    from oria.kernel.events import EventBus

logger = logging.getLogger(__name__)

# Intervals in seconds
_STANDINGS_INTERVAL = 3600 * 4   # 4 hours
_FIXTURES_INTERVAL = 3600        # 1 hour
_LINEUPS_INTERVAL = 1800         # 30 min
_TICK_INTERVAL = 60              # check every minute


class IngestionScheduler:
    """Module optionnel : pré-fetch piloté par les follows."""

    name: str = "ingestion"
    required: bool = False
    provides: tuple[str, ...] = ("prefetch",)

    def __init__(
        self,
        *,
        follow_service: FollowService | None = None,
        standings: StandingsRepository | None = None,
        fixtures: FixturesRepository | None = None,
        lineups: LineupsRepository | None = None,
        event_bus: EventBus | None = None,
    ) -> None:
        self._follows = follow_service
        self._standings = standings
        self._fixtures = fixtures
        self._lineups = lineups
        self._event_bus = event_bus
        self._last_standings = 0.0
        self._last_fixtures = 0.0
        self._last_lineups = 0.0

    async def start(self) -> None:
        logger.info("ingestion scheduler ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def run_loop(self) -> None:
        """Boucle supervisée — exécute les jobs d'ingestion."""
        while True:
            try:
                await self._tick()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("ingestion tick failed")
            await asyncio.sleep(_TICK_INTERVAL)

    async def _tick(self) -> None:
        """Un cycle d'ingestion."""
        if self._follows is None:
            return

        now = time.monotonic()
        registry = await self._follows.aggregated_registry()

        if not registry.league_ids and not registry.team_ids:
            return  # nothing followed

        # Standings refresh
        if now - self._last_standings >= _STANDINGS_INTERVAL and self._standings:
            for league_id in registry.league_ids:
                try:
                    await self._standings.get(f"league={league_id}", allow_stale=False)
                    logger.debug("ingested standings for league %d", league_id)
                except Exception:
                    logger.warning("standings ingestion failed for league %d", league_id, exc_info=True)
            self._last_standings = now

        # Fixtures refresh
        if now - self._last_fixtures >= _FIXTURES_INTERVAL and self._fixtures:
            for league_id in registry.league_ids:
                try:
                    await self._fixtures.get(f"league={league_id}&next=10", allow_stale=False)
                    logger.debug("ingested fixtures for league %d", league_id)
                except Exception:
                    logger.warning("fixtures ingestion failed for league %d", league_id, exc_info=True)
            self._last_fixtures = now

        # Lineups (closer to match time, more frequent)
        if now - self._last_lineups >= _LINEUPS_INTERVAL and self._lineups:
            for league_id in registry.league_ids:
                try:
                    await self._lineups.get(f"league={league_id}", allow_stale=False)
                    logger.debug("ingested lineups for league %d", league_id)
                except Exception:
                    logger.warning("lineups ingestion failed for league %d", league_id, exc_info=True)
            self._last_lineups = now
