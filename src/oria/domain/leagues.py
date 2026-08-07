"""Repository des ligues (cache-first)."""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs

from oria.domain.base import BaseRepository
from oria.providers.apifootball.mapper import map_leagues


class LeaguesRepository(BaseRepository):
    name: str = "repo_leagues"
    provides: tuple[str, ...] = ("leagues",)
    volatility: str = "immuable"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="leagues", **kwargs)  # type: ignore[arg-type]

    async def _fetch(self, key: str) -> Any:  # noqa: ANN401
        if self._client is None:
            return None
        params = _parse_key(key)
        raw = await self._client.fetch("/leagues", params)
        result = map_leagues(raw)
        return result if result else None


def _parse_key(key: str) -> dict[str, str]:
    parsed = parse_qs(key)
    return {k: v[0] for k, v in parsed.items() if v and v[0]}
