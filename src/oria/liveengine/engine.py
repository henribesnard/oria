"""Live engine — poller de scores en direct (stub M7)."""

from __future__ import annotations

import asyncio
import logging

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class LiveEngine:
    """Module optionnel : poller partagé/borné par match."""

    name: str = "liveengine"
    required: bool = False
    provides: tuple[str, ...] = ("live_scores",)

    async def start(self) -> None:
        logger.info("live engine ready (stub)")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def run_loop(self) -> None:
        """Boucle supervisée — stub."""
        while True:
            await asyncio.sleep(30)
