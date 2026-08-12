"""Repository des meilleurs buteurs et passeurs (cache-first)."""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs

from oria.domain.base import BaseRepository
from oria.providers.apifootball.mapper import map_top_assists, map_top_scorers


class TopScorersRepository(BaseRepository):
    name: str = "repo_top_scorers"
    provides: tuple[str, ...] = ("top_scorers",)
    volatility: str = "lent"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="top_scorers", **kwargs)  # type: ignore[arg-type]

    async def _fetch(self, key: str) -> Any:  # noqa: ANN401
        if self._client is None:
            return None
        params = _parse_key(key)
        raw = await self._client.fetch("/players/topscorers", params)
        result = map_top_scorers(raw)
        return result if result else None


class TopAssistsRepository(BaseRepository):
    name: str = "repo_top_assists"
    provides: tuple[str, ...] = ("top_assists",)
    volatility: str = "lent"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="top_assists", **kwargs)  # type: ignore[arg-type]

    async def _fetch(self, key: str) -> Any:  # noqa: ANN401
        if self._client is None:
            return None
        params = _parse_key(key)
        raw = await self._client.fetch("/players/topassists", params)
        result = map_top_assists(raw)
        return result if result else None


def _parse_key(key: str) -> dict[str, str]:
    """Parse 'league=61&season=2024' -> {'league': '61', 'season': '2024'}."""
    parsed = parse_qs(key)
    return {k: v[0] for k, v in parsed.items() if v and v[0]}
