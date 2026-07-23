"""Modèles du module identité."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel


class UserStatus(StrEnum):
    ACTIVE = "active"
    SUSPENDED = "suspended"
    DELETED = "deleted"


class UserRole(StrEnum):
    USER = "user"
    ADMIN = "admin"


class User(BaseModel):
    """Compte utilisateur interne Oria."""

    id: str
    status: UserStatus = UserStatus.ACTIVE
    role: UserRole = UserRole.USER
    display_name: str = ""
    locale: str = "fr"
    timezone: str = "Europe/Paris"
    created_at: float = 0.0
    deleted_at: float | None = None


class Identity(BaseModel):
    """Liaison entre un provider externe et un compte Oria."""

    id: str
    user_id: str
    provider: str
    external_id: str
    created_at: float = 0.0
