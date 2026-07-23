"""Dépendances FastAPI : authentification, rôles, rate-limiting."""

from __future__ import annotations

from typing import Any

import jwt
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_security = HTTPBearer(auto_error=False)

# Injecté au démarrage par init_web
_jwt_secret: str = ""
_auth_service: Any = None
_identity_service: Any = None


def init_dependencies(
    *,
    jwt_secret: str,
    auth_service: object | None = None,
    identity_service: object | None = None,
) -> None:
    global _jwt_secret, _auth_service, _identity_service  # noqa: PLW0603
    _jwt_secret = jwt_secret
    _auth_service = auth_service
    _identity_service = identity_service


async def get_current_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> dict[str, str]:
    """Extrait et vérifie le JWT. Renvoie {user_id, role}."""
    token: str | None = None

    # 1. Header Authorization: Bearer <token>
    if credentials is not None:
        token = credentials.credentials

    # 2. Cookie fallback
    if token is None:
        token = request.cookies.get("access_token")

    if token is None:
        raise HTTPException(status_code=401, detail="authentication required")

    try:
        payload = jwt.decode(token, _jwt_secret, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="invalid token")

    user_id = payload.get("sub")
    role = payload.get("role", "user")
    if not user_id:
        raise HTTPException(status_code=401, detail="invalid token")

    return {"user_id": str(user_id), "role": str(role)}


async def require_admin(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    """Vérifie que l'utilisateur a le rôle admin."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="admin required")
    return user


async def optional_user(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(_security),
) -> dict[str, str] | None:
    """Extrait le user si authentifié, None sinon."""
    token: str | None = None
    if credentials is not None:
        token = credentials.credentials
    if token is None:
        token = request.cookies.get("access_token")
    if token is None:
        return None
    try:
        payload = jwt.decode(token, _jwt_secret, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            return None
        return {"user_id": str(user_id), "role": str(payload.get("role", "user"))}
    except jwt.PyJWTError:
        return None
