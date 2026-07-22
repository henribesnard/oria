"""Ingestion — pré-fetch programmé (stub M7)."""

from __future__ import annotations

import asyncio
import logging

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class IngestionScheduler:
    """Module optionnel : pré-fetch piloté par les follows."""

    name: str = "ingestion"
    required: bool = False
    provides: tuple[str, ...] = ("prefetch",)

    async def start(self) -> None:
        logger.info("ingestion scheduler ready (stub)")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def run_loop(self) -> None:
        """Boucle supervisée — stub."""
        while True:
            await asyncio.sleep(3600)
