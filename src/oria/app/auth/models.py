"""Modèles du module auth."""

from __future__ import annotations

from pydantic import BaseModel


class TokenPair(BaseModel):
    """Paire access + refresh renvoyée à l'authentification."""

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int = 900  # secondes


class Credential(BaseModel):
    user_id: str
    email: str
    password_hash: str
    email_verified: bool = False
    created_at: float = 0.0


class Session(BaseModel):
    id: str
    user_id: str
    refresh_token_hash: str
    user_agent: str = ""
    ip: str = ""
    expires_at: float = 0.0
    revoked_at: float | None = None
    created_at: float = 0.0
