"""Client unique API-Football (stub M3)."""

from __future__ import annotations

import logging
from typing import Any

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class ApiFootballClient:
    """Module optionnel : point d'entrée unique API-Football."""

    name: str = "apifootball"
    required: bool = False
    provides: tuple[str, ...] = ("football_data",)

    def __init__(self, *, api_key: str, daily_budget: int = 7500) -> None:
        self._api_key = api_key
        self._daily_budget = daily_budget
        self._available = False

    async def start(self) -> None:
        if not self._api_key:
            raise RuntimeError("APIFOOTBALL_KEY not configured")
        self._available = True
        logger.info("apifootball client ready (stub)")

    async def stop(self) -> None:
        self._available = False

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._available else Availability.DOWN
        return ModuleStatus(name=self.name, availability=avail)

    async def fetch(self, endpoint: str, params: dict[str, Any] | None = None) -> Any:  # noqa: ANN401
        """Stub — sera implémenté avec httpx + governor."""
        _ = endpoint, params
        return {}
