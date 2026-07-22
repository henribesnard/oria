"""Repository des cotes (stub)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class OddsRepository(BaseRepository):
    name: str = "repo_odds"
    provides: tuple[str, ...] = ("odds",)
    volatility: str = "semi_rapide"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="odds", **kwargs)  # type: ignore[arg-type]
