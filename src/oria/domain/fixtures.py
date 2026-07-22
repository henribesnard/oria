"""Repository des matchs (cache-first)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class FixturesRepository(BaseRepository):
    name: str = "repo_fixtures"
    provides: tuple[str, ...] = ("fixtures",)
    volatility: str = "semi_rapide"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="fixtures", **kwargs)  # type: ignore[arg-type]
