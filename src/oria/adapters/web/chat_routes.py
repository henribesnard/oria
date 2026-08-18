"""Routes chat : POST /chat et POST /chat/stream."""

from __future__ import annotations

import hashlib
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from oria.adapters.web.dependencies import get_current_user, optional_user
from oria.kernel.models import Context, IncomingRequest, Response

router = APIRouter(prefix="/chat", tags=["chat"])

_handle_message: Any = None
_stream_message: Any = None


def init_chat_routes(
    handle_message: object,
    stream_message: object | None = None,
) -> None:
    global _handle_message, _stream_message  # noqa: PLW0603
    _handle_message = handle_message
    _stream_message = stream_message


class ChatRequest(BaseModel):
    text: str
    context: Context = Context()


@router.post("")
async def chat(
    req: ChatRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    """Chat bloquant — requiert authentification."""
    if _handle_message is None:
        raise HTTPException(status_code=503, detail="service not ready")
    incoming = IncomingRequest(
        user_id=user["user_id"],
        text=req.text,
        context=req.context,
    )
    resp: Response = await _handle_message(incoming)
    return resp.model_dump()


@router.post("/stream")
async def chat_stream(
    req: ChatRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> StreamingResponse:
    """Chat streaming SSE — requiert authentification."""
    if _stream_message is None:
        raise HTTPException(status_code=503, detail="streaming not available")
    incoming = IncomingRequest(
        user_id=user["user_id"],
        text=req.text,
        context=req.context,
    )
    return StreamingResponse(
        _stream_message(incoming),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/public")
async def chat_public(
    request: Request,
    req: ChatRequest,
    user: dict[str, str] | None = Depends(optional_user),
) -> dict[str, Any]:
    """Chat public (user optionnel, limité par IP)."""
    if _handle_message is None:
        raise HTTPException(status_code=503, detail="service not ready")
    if user:
        user_id = user["user_id"]
    else:
        # Use hashed IP for anonymous rate-limit isolation
        client_ip = request.client.host if request.client else "unknown"
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
        user_id = f"anon:{ip_hash}"
    incoming = IncomingRequest(
        user_id=user_id,
        text=req.text,
        context=req.context,
    )
    resp: Response = await _handle_message(incoming)
    return resp.model_dump()
