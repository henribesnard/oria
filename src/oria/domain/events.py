"""Événements domaine pour le bus interne."""

from __future__ import annotations

from pydantic import BaseModel


class DomainEvent(BaseModel):
    """Base pour tous les événements domaine."""
    event_type: str
    fixture_id: int = 0
    league_id: int = 0
    team_id: int = 0


class GoalEvent(DomainEvent):
    event_type: str = "goal"
    player_name: str = ""
    minute: int = 0
    home_team: str = ""
    away_team: str = ""
    home_score: int = 0
    away_score: int = 0


class CardEvent(DomainEvent):
    event_type: str = "card"
    player_name: str = ""
    card_type: str = ""  # yellow | red
    minute: int = 0


class MatchStartEvent(DomainEvent):
    event_type: str = "match_start"
    home_team: str = ""
    away_team: str = ""


class MatchEndEvent(DomainEvent):
    event_type: str = "match_end"
    home_team: str = ""
    away_team: str = ""
    home_score: int = 0
    away_score: int = 0


class LineupEvent(DomainEvent):
    event_type: str = "lineup"
    home_team: str = ""
    away_team: str = ""


class SubstitutionEvent(DomainEvent):
    event_type: str = "substitution"
    player_in: str = ""
    player_out: str = ""
    minute: int = 0
