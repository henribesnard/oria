"""Modèles du module preferences."""

from __future__ import annotations

from pydantic import BaseModel


class Follow(BaseModel):
    id: str
    user_id: str
    entity_type: str  # league | team | player
    entity_id: int
    entity_name: str = ""
    created_at: float = 0.0


class NotificationSettings(BaseModel):
    user_id: str
    prematch: bool = True
    result: bool = True
    lineup: bool = True
    live_goal: bool = False
    digest: bool = True
    quiet_start: str = "23:00"
    quiet_end: str = "08:00"
    timezone: str = "Europe/Paris"
    updated_at: float = 0.0


class AggregatedFollows(BaseModel):
    """Union de tous les follows pour piloter l'ingestion."""

    league_ids: list[int] = []
    team_ids: list[int] = []
    player_ids: list[int] = []
