"""Modèles de domaine (DTO Pydantic)."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel


class Context(BaseModel):
    """Contexte résolu par l'UI (IDs déjà connus)."""

    country: str | None = None
    zone: str | None = None
    league_id: int | None = None
    season: int | None = None
    fixture_id: int | None = None
    team_id: int | None = None
    player_id: int | None = None


class IncomingRequest(BaseModel):
    """Requête entrante, agnostique au canal."""

    user_id: str
    text: str
    context: Context = Context()
    locale: str = "fr"


class Attachment(BaseModel):
    """Pièce jointe structurée à la réponse."""

    kind: Literal["fixture_card", "table", "link", "image"]
    data: dict[str, object]


class SuggestedAction(BaseModel):
    """Action suggérée présentée à l'utilisateur."""

    label: str
    payload: dict[str, object]


class Response(BaseModel):
    """Réponse produite par le pipeline — toujours valide."""

    text: str
    attachments: list[Attachment] = []
    suggested_actions: list[SuggestedAction] = []
    degraded: bool = False
    freshness: str | None = None
