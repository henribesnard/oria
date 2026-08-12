"""Repository des confrontations directes (cache-first)."""

from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs

from oria.domain.base import BaseRepository
from oria.providers.apifootball.mapper import map_head2head


class HeadToHeadRepository(BaseRepository):
    name: str = "repo_head2head"
    provides: tuple[str, ...] = ("head2head",)
    volatility: str = "lent"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="head2head", **kwargs)  # type: ignore[arg-type]

    async def _fetch(self, key: str) -> Any:  # noqa: ANN401
        if self._client is None:
            return None
        params = _parse_key(key)
        raw = await self._client.fetch("/fixtures/headtohead", params)
        result = map_head2head(raw)
        return result if result else None


def _parse_key(key: str) -> dict[str, str]:
    """Parse 'h2h=85-87&last=10' -> {'h2h': '85-87', 'last': '10'}."""
    parsed = parse_qs(key)
    return {k: v[0] for k, v in parsed.items() if v and v[0]}
