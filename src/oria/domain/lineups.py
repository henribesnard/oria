"""Repository des compositions (stub)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class LineupsRepository(BaseRepository):
    name: str = "repo_lineups"
    provides: tuple[str, ...] = ("lineups",)
    volatility: str = "semi_rapide"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="lineups", **kwargs)  # type: ignore[arg-type]
