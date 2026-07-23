"""Routes réglages : /settings/*."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from oria.adapters.web.dependencies import get_current_user

router = APIRouter(prefix="/settings", tags=["settings"])

_notif_settings_service: Any = None
_conversation_service: Any = None


def init_settings_routes(
    notif_settings_service: object, conversation_service: object | None = None,
) -> None:
    global _notif_settings_service, _conversation_service  # noqa: PLW0603
    _notif_settings_service = notif_settings_service
    _conversation_service = conversation_service


class NotifSettingsUpdate(BaseModel):
    prematch: bool | None = None
    result: bool | None = None
    lineup: bool | None = None
    live_goal: bool | None = None
    digest: bool | None = None
    quiet_start: str | None = None
    quiet_end: str | None = None
    timezone: str | None = None


@router.get("/notifications")
async def get_notification_settings(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    if _notif_settings_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    ns = await _notif_settings_service.get(user["user_id"])
    return ns.model_dump()


@router.patch("/notifications")
async def update_notification_settings(
    req: NotifSettingsUpdate,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    if _notif_settings_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    fields = req.model_dump(exclude_none=True)
    ns = await _notif_settings_service.update(user["user_id"], **fields)
    return ns.model_dump()


@router.delete("/conversations")
async def clear_conversations(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    if _conversation_service is None:
        raise HTTPException(status_code=503, detail="service not available")
    await _conversation_service.clear(user["user_id"])
    return {"status": "cleared"}
