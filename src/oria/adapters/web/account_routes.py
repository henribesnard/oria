"""Routes du compte utilisateur : /me/*."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from oria.adapters.web.dependencies import get_current_user

router = APIRouter(prefix="/me", tags=["account"])

# Injecté au démarrage
_identity_service: Any = None


def init_account_routes(identity_service: object) -> None:
    global _identity_service  # noqa: PLW0603
    _identity_service = identity_service


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    locale: str | None = None
    timezone: str | None = None


class LinkIdentityRequest(BaseModel):
    provider: str
    external_id: str


@router.get("")
async def get_profile(user: dict[str, str] = Depends(get_current_user)) -> dict[str, Any]:
    if _identity_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    account = await _identity_service.get(user["user_id"])
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")
    return account.model_dump()


@router.patch("")
async def update_profile(
    req: UpdateProfileRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    if _identity_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    fields = req.model_dump(exclude_none=True)
    account = await _identity_service.update_profile(user["user_id"], **fields)
    if account is None:
        raise HTTPException(status_code=404, detail="account not found")
    return account.model_dump()


@router.delete("")
async def delete_account(user: dict[str, str] = Depends(get_current_user)) -> dict[str, str]:
    if _identity_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    await _identity_service.delete_account(user["user_id"])
    return {"status": "deleted"}


@router.get("/identities")
async def list_identities(
    user: dict[str, str] = Depends(get_current_user),
) -> list[dict[str, str]]:
    if _identity_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    return await _identity_service.get_identities(user["user_id"])


@router.post("/identities/link")
async def link_identity(
    req: LinkIdentityRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    if _identity_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    try:
        await _identity_service.link(user["user_id"], req.provider, req.external_id)
        return {"status": "linked"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
