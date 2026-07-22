"""Repository des blessures (stub)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class InjuriesRepository(BaseRepository):
    name: str = "repo_injuries"
    provides: tuple[str, ...] = ("injuries",)
    volatility: str = "semi_rapide"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="injuries", **kwargs)  # type: ignore[arg-type]
