"""Repository des scores en direct (stub)."""

from __future__ import annotations

from oria.domain.base import BaseRepository


class LiveRepository(BaseRepository):
    name: str = "repo_live"
    provides: tuple[str, ...] = ("live_scores",)
    volatility: str = "live"

    def __init__(self, **kwargs: object) -> None:
        super().__init__(domain="live", **kwargs)  # type: ignore[arg-type]
