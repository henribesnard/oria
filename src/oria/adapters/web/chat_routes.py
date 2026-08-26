"""Routes chat : POST /chat, POST /chat/stream, gestion des threads."""

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
_conversation_service: Any = None


def init_chat_routes(
    handle_message: object,
    stream_message: object | None = None,
    conversation_service: object | None = None,
) -> None:
    global _handle_message, _stream_message, _conversation_service  # noqa: PLW0603
    _handle_message = handle_message
    _stream_message = stream_message
    _conversation_service = conversation_service


class ChatRequest(BaseModel):
    text: str
    context: Context = Context()
    thread_id: str | None = None


class CreateThreadRequest(BaseModel):
    title: str = ""
    context: dict[str, object] = {}


# ── Chat endpoints ─────────────────────────────────────────────────────


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
        thread_id=req.thread_id,
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
        thread_id=req.thread_id,
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
        client_ip = request.client.host if request.client else "unknown"
        ip_hash = hashlib.sha256(client_ip.encode()).hexdigest()[:16]
        user_id = f"anon:{ip_hash}"
    incoming = IncomingRequest(
        user_id=user_id,
        text=req.text,
        context=req.context,
        thread_id=req.thread_id,
    )
    resp: Response = await _handle_message(incoming)
    return resp.model_dump()


# ── Thread endpoints ───────────────────────────────────────────────────


@router.get("/threads")
async def list_threads(
    user: dict[str, str] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Liste des conversations de l'utilisateur."""
    if _conversation_service is None:
        raise HTTPException(status_code=503, detail="service not ready")
    threads = await _conversation_service.list_threads(user["user_id"])
    return [t.model_dump() for t in threads]


@router.post("/threads")
async def create_thread(
    req: CreateThreadRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    """Crée un nouveau thread de conversation."""
    if _conversation_service is None:
        raise HTTPException(status_code=503, detail="service not ready")
    thread = await _conversation_service.create_thread(
        user["user_id"], title=req.title, context=req.context,
    )
    return thread.model_dump()


@router.get("/threads/{thread_id}/messages")
async def get_thread_messages(
    thread_id: str,
    user: dict[str, str] = Depends(get_current_user),
) -> list[dict[str, Any]]:
    """Messages d'un thread."""
    if _conversation_service is None:
        raise HTTPException(status_code=503, detail="service not ready")
    # Vérifier que le thread appartient à l'utilisateur
    thread = await _conversation_service.get_thread(thread_id)
    if thread is None or thread.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="thread not found")
    turns = await _conversation_service.recent(user["user_id"], thread_id=thread_id)
    return [t.model_dump() for t in turns]


@router.delete("/threads/{thread_id}")
async def delete_thread(
    thread_id: str,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    """Supprime un thread et ses messages."""
    if _conversation_service is None:
        raise HTTPException(status_code=503, detail="service not ready")
    thread = await _conversation_service.get_thread(thread_id)
    if thread is None or thread.user_id != user["user_id"]:
        raise HTTPException(status_code=404, detail="thread not found")
    await _conversation_service.delete_thread(thread_id)
    return {"status": "deleted"}
