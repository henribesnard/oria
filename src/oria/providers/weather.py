"""Provider météo externe (stub M3)."""

from __future__ import annotations

import logging

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class WeatherProvider:
    """Module optionnel : météo stade."""

    name: str = "weather"
    required: bool = False
    provides: tuple[str, ...] = ("weather",)

    def __init__(self, *, api_key: str) -> None:
        self._api_key = api_key
        self._available = False

    async def start(self) -> None:
        if not self._api_key:
            raise RuntimeError("WEATHER_API_KEY not configured")
        self._available = True
        logger.info("weather provider ready (stub)")

    async def stop(self) -> None:
        self._available = False

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._available else Availability.DOWN
        return ModuleStatus(name=self.name, availability=avail)
