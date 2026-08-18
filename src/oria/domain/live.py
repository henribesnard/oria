"""Repository des scores en direct (cache-first)."""

from __future__ import annotations

from typing import Any

from oria.domain.base import BaseRepository
from oria.providers.apifootball.mapper import map_fixtures


class LiveRepository(BaseRepository):
    name: str = "repo_live"
    provides: tuple[str, ...] = ("live_scores",)
    volatility: str = "live"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="live", **kwargs)  # type: ignore[arg-type]

    async def _fetch(self, key: str) -> Any:  # noqa: ANN401
        if self._client is None:
            return None
        # Parse key prefix: "fixture:<id>" for a specific match, otherwise league filter
        if key.startswith("fixture:"):
            fixture_id = key.removeprefix("fixture:")
            params: dict[str, str] = {"id": fixture_id, "live": "all"}
        else:
            params = {"live": "all"}
            if key:
                params["league"] = key
        raw = await self._client.fetch("/fixtures", params)
        result = map_fixtures(raw)
        return result if result else None
