"""Dispatcher de notifications push (stub M7)."""

from __future__ import annotations

import logging

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class NotificationDispatcher:
    """Module optionnel : route les push via OutboundPort."""

    name: str = "notifications"
    required: bool = False
    provides: tuple[str, ...] = ("push",)

    async def start(self) -> None:
        logger.info("notification dispatcher ready (stub)")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)
