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
        # Pour le live, on utilise le paramètre live=all
        params: dict[str, str] = {"live": "all"}
        if key:
            params["league"] = key
        raw = await self._client.fetch("/fixtures", params)
        result = map_fixtures(raw)
        return result if result else None
