"""Routes live : /live/* — flux SSE de notifications en temps réel."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

from oria.adapters.web.dependencies import get_current_user

router = APIRouter(prefix="/live", tags=["live"])

_sse_port: Any = None


def init_live_routes(sse_port: object | None = None) -> None:
    global _sse_port  # noqa: PLW0603
    _sse_port = sse_port


@router.get("/notifications/stream")
async def notification_stream(
    user: dict[str, str] = Depends(get_current_user),
) -> StreamingResponse:
    """Flux SSE de notifications pour l'utilisateur connecté."""
    if _sse_port is None:
        raise HTTPException(status_code=503, detail="live notifications not available")
    return StreamingResponse(
        _sse_port.stream(user["user_id"]),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
