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


class Thread(BaseModel):
    """Un fil de conversation."""

    id: str
    user_id: str
    title: str = ""
    context: dict[str, object] = {}
    created_at: float = 0.0
    updated_at: float = 0.0


class ThreadSummary(BaseModel):
    """Résumé d'un thread pour la liste."""

    id: str
    title: str = ""
    context: dict[str, object] = {}
    last_message: str = ""
    updated_at: float = 0.0


class ConversationWindow(BaseModel):
    """Fenêtre de conversation récente."""

    turns: list[Turn] = []
    context: Context = Context()
