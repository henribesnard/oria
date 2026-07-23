"""Modèles du module conversations."""

from __future__ import annotations

from pydantic import BaseModel

from oria.kernel.models import Context


class Turn(BaseModel):
    """Un tour de conversation (message user ou assistant)."""

    id: int = 0
    user_id: str
    role: str  # user | assistant
    text: str
    metadata: dict[str, object] = {}
    created_at: float = 0.0


class ConversationWindow(BaseModel):
    """Fenêtre de conversation récente."""

    turns: list[Turn] = []
    context: Context = Context()
