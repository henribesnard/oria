"""Live engine — poller de scores en direct piloté par les follows."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.preferences.service import FollowService
    from oria.domain.live import LiveRepository
    from oria.kernel.events import EventBus
    from oria.liveengine.poller import MatchPoller

logger = logging.getLogger(__name__)

_SCAN_INTERVAL = 60  # Check for new live matches every 60s
_MAX_CONCURRENT_POLLERS = 10


class LiveEngine:
    """Module optionnel : poller partagé/borné par match."""

    name: str = "liveengine"
    required: bool = False
    provides: tuple[str, ...] = ("live_scores",)

    def __init__(
        self,
        *,
        live_repo: LiveRepository | None = None,
        follow_service: FollowService | None = None,
        event_bus: EventBus | None = None,
    ) -> None:
        self._live_repo = live_repo
        self._follows = follow_service
        self._event_bus = event_bus
        self._active_pollers: dict[int, asyncio.Task[None]] = {}
        self._running = False

    async def start(self) -> None:
        self._running = True
        logger.info("live engine ready")

    async def stop(self) -> None:
        self._running = False
        for task in self._active_pollers.values():
            task.cancel()
        if self._active_pollers:
            await asyncio.gather(*self._active_pollers.values(), return_exceptions=True)
        self._active_pollers.clear()

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._running else Availability.DOWN
        return ModuleStatus(
            name=self.name,
            availability=avail,
            details={"active_pollers": len(self._active_pollers)},
        )

    async def run_loop(self) -> None:
        """Boucle supervisée — scanne les matchs en direct et lance des pollers."""
        while self._running:
            try:
                await self._scan_live_matches()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("live engine scan failed")
            await asyncio.sleep(_SCAN_INTERVAL)

    async def _scan_live_matches(self) -> None:
        """Détecte les matchs en cours et lance/arrête les pollers."""
        if self._live_repo is None or self._follows is None:
            return

        registry = await self._follows.aggregated_registry()
        if not registry.league_ids:
            return

        # Fetch all live matches
        live_fixtures: list[dict[str, Any]] = []
        for league_id in registry.league_ids:
            try:
                data = await self._live_repo.get(str(league_id), allow_stale=False)
                if data and isinstance(data, list):
                    live_fixtures.extend(data)
            except Exception:
                logger.debug("live fetch failed for league %d", league_id, exc_info=True)

        # Get fixture IDs currently live
        live_ids = set()
        for fix in live_fixtures:
            fid = fix.get("fixture_id") or fix.get("id")
            if fid:
                live_ids.add(int(fid))

        # Stop pollers for finished matches
        finished = set(self._active_pollers.keys()) - live_ids
        for fid in finished:
            task = self._active_pollers.pop(fid)
            task.cancel()
            logger.info("stopped poller for fixture %d (match ended)", fid)
            if self._event_bus:
                from oria.domain.events import MatchEndEvent
                self._event_bus.publish("match_end", MatchEndEvent(fixture_id=fid))

        # Start pollers for new live matches (respect concurrency limit)
        for fid in live_ids:
            if fid in self._active_pollers:
                continue
            if len(self._active_pollers) >= _MAX_CONCURRENT_POLLERS:
                logger.warning("max concurrent pollers reached (%d)", _MAX_CONCURRENT_POLLERS)
                break
            from oria.liveengine.poller import MatchPoller
            poller = MatchPoller(
                fixture_id=fid,
                live_repo=self._live_repo,
                event_bus=self._event_bus,
            )
            task = asyncio.create_task(poller.poll_loop(), name=f"poller-{fid}")
            self._active_pollers[fid] = task
            logger.info("started poller for fixture %d", fid)
