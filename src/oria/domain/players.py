"""Repository des joueurs (stub)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class PlayersRepository(BaseRepository):
    name: str = "repo_players"
    provides: tuple[str, ...] = ("players",)
    volatility: str = "lent"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="players", **kwargs)  # type: ignore[arg-type]
