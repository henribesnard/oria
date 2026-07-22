"""Repository des classements (cache-first)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class StandingsRepository(BaseRepository):
    name: str = "repo_standings"
    provides: tuple[str, ...] = ("standings",)
    volatility: str = "lent"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="standings", **kwargs)  # type: ignore[arg-type]
