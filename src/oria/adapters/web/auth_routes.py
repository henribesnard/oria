"""Routes d'authentification : /auth/*."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/auth", tags=["auth"])

# Injecté au démarrage
_auth_service: Any = None


def init_auth_routes(auth_service: object) -> None:
    global _auth_service  # noqa: PLW0603
    _auth_service = auth_service


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    locale: str = "fr"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class ResetRequest(BaseModel):
    email: EmailStr


class ResetConfirm(BaseModel):
    token: str
    new_password: str


@router.post("/register")
async def register(req: RegisterRequest, request: Request) -> dict[str, Any]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    try:
        pair = await _auth_service.register_email(
            req.email, req.password, locale=req.locale,
        )
        result: dict[str, Any] = pair.model_dump()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/login")
async def login(req: LoginRequest, request: Request) -> dict[str, Any]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    ip = request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")
    try:
        pair = await _auth_service.login_email(
            req.email, req.password, ip=ip, user_agent=user_agent,
        )
        result: dict[str, Any] = pair.model_dump()
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/refresh")
async def refresh(req: RefreshRequest) -> dict[str, Any]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    try:
        pair = await _auth_service.refresh(req.refresh_token)
        result: dict[str, Any] = pair.model_dump()
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@router.post("/logout")
async def logout(req: RefreshRequest) -> dict[str, str]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    await _auth_service.logout(req.refresh_token)
    return {"status": "ok"}


@router.post("/verify")
async def verify_email(token: str) -> dict[str, str]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    try:
        await _auth_service.verify_email(token)
        return {"status": "verified"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reset")
async def request_reset(req: ResetRequest) -> dict[str, str]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    await _auth_service.request_password_reset(req.email)
    # Toujours la même réponse (ne pas révéler si l'email existe)
    return {"status": "ok"}


@router.post("/reset/confirm")
async def confirm_reset(req: ResetConfirm) -> dict[str, str]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    try:
        await _auth_service.reset_password(req.token, req.new_password)
        return {"status": "password_reset"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/oauth/{provider}")
async def oauth_callback(provider: str, code: str) -> dict[str, Any]:
    if _auth_service is None:
        raise HTTPException(status_code=503, detail="auth not available")
    try:
        pair = await _auth_service.oauth_callback(provider, code)
        result: dict[str, Any] = pair.model_dump()
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
