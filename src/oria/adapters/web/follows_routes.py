"""Routes suivis : /follows/*."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from oria.adapters.web.dependencies import get_current_user

router = APIRouter(prefix="/follows", tags=["follows"])

_follow_service: Any = None


def init_follows_routes(follow_service: object) -> None:
    global _follow_service  # noqa: PLW0603
    _follow_service = follow_service


class FollowRequest(BaseModel):
    entity_type: str  # league | team | player
    entity_id: int
    entity_name: str = ""
    logo_url: str = ""


class UnfollowRequest(BaseModel):
    entity_type: str
    entity_id: int


@router.get("")
async def list_follows(
    entity_type: str | None = None,
    user: dict[str, str] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    if _follow_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    follows = await _follow_service.list_follows(user["user_id"], entity_type)
    return [f.model_dump() for f in follows]


@router.post("")
async def follow(
    req: FollowRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    if _follow_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    f = await _follow_service.follow(
        user["user_id"], req.entity_type, req.entity_id, req.entity_name,
        logo_url=req.logo_url,
    )
    return f.model_dump()


@router.delete("")
async def unfollow(
    req: UnfollowRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    if _follow_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    removed = await _follow_service.unfollow(
        user["user_id"], req.entity_type, req.entity_id,
    )
    return {"status": "removed" if removed else "not_found"}
