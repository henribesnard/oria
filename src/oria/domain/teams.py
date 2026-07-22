"""Repository des équipes (stub)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class TeamsRepository(BaseRepository):
    name: str = "repo_teams"
    provides: tuple[str, ...] = ("teams",)
    volatility: str = "immuable"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="teams", **kwargs)  # type: ignore[arg-type]
