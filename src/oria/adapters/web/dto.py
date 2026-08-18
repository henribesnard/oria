"""DTOs de réponse web — adaptent le modèle interne au contrat frontend."""

from __future__ import annotations

from pydantic import BaseModel


class MeResponse(BaseModel):
    """Réponse GET /me — contrat aligné avec frontend/mobile."""

    user_id: str
    email: str | None = None
    role: str
    display_name: str
    status: str
    locale: str
    timezone: str
    created_at: float


class AdminUserResponse(MeResponse):
    """Réponse admin /admin/users — mêmes champs pour l'instant."""
