"""Streaming — async generator pour réponses SSE."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING, Any

from oria.app.entitlements.models import DecisionKind
from oria.core.prerouter import _ACK_RE, _GREETING_RE, _HELP_RE
from oria.core.safety import (
    GAMBLING_HELP_RESPONSE,
    INJECTION_RESPONSE,
    detect_gambling_distress,
    detect_injection,
)
from oria.kernel.resilience import guard

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from oria.app.conversations.service import ConversationService
    from oria.app.entitlements.service import Entitlements
    from oria.core.orchestrator import Orchestrator
    from oria.core.prerouter import PreRouter
    from oria.core.synthesis import Synthesis
    from oria.kernel.models import IncomingRequest

logger = logging.getLogger(__name__)


async def stream_message(
    req: IncomingRequest,
    *,
    synthesis: Synthesis,
    prerouter: PreRouter | None = None,
    orchestrator: Orchestrator | None = None,
    entitlements: Entitlements | None = None,
    conversations: ConversationService | None = None,
) -> AsyncIterator[str]:
    """Génère des événements SSE pour une requête chat.

    Format SSE :
        data: {"type": "chunk", "content": "texte..."}
        data: {"type": "done", "text": "texte complet"}
        data: {"type": "error", "message": "..."}
    """
    try:
        async for event in _stream_process(
            req,
            synthesis=synthesis,
            prerouter=prerouter,
            orchestrator=orchestrator,
            entitlements=entitlements,
            conversations=conversations,
        ):
            yield event
    except Exception:
        logger.exception("stream error")
        yield _sse_event({"type": "error", "message": "Erreur interne."})


async def _stream_process(
    req: IncomingRequest,
    *,
    synthesis: Synthesis,
    prerouter: PreRouter | None = None,
    orchestrator: Orchestrator | None = None,
    entitlements: Entitlements | None = None,
    conversations: ConversationService | None = None,
) -> AsyncIterator[str]:
    """Logique de streaming interne."""
    # Safety filters (AVANT quota — ne doivent jamais être bloqués)
    if detect_injection(req.text):
        yield _sse_event({"type": "done", "text": INJECTION_RESPONSE})
        return
    if detect_gambling_distress(req.text):
        yield _sse_event({"type": "done", "text": GAMBLING_HELP_RESPONSE})
        return

    # Entitlements check — bypass pour routes triviales
    _exempt = bool(
        _GREETING_RE.search(req.text) or _ACK_RE.search(req.text) or _HELP_RE.search(req.text)
    )
    if entitlements is not None and not _exempt:
        decision = await entitlements.check(req.user_id, "chat_message")
        if decision.kind != DecisionKind.ALLOW:
            yield _sse_event({"type": "quota", "message": decision.reason})
            return

    # Conversation history
    conversation_history: list[dict[str, str]] | None = None
    if conversations is not None:
        async with guard("stream_context", on_error=lambda: None):
            persisted = await conversations.get_context(req.user_id)
            ctx = req.context
            merged = persisted.model_copy(
                update={k: v for k, v in ctx.model_dump().items() if v is not None},
            )
            req = req.model_copy(update={"context": merged})

            turns = await conversations.recent(req.user_id)
            if turns:
                conversation_history = [{"role": t.role, "content": t.text} for t in turns]

    # Prerouter (non-streaming)
    if prerouter is not None:
        async with guard("stream_prerouter", on_error=lambda: None):
            result = await prerouter.try_route(req)
            if result is not None:
                yield _sse_event({
                    "type": "done",
                    "text": result.text,
                    "attachments": [a.model_dump() for a in result.attachments],
                    "suggested_actions": [s.model_dump() for s in result.suggested_actions],
                })
                await _persist_stream_turn(req, result.text, entitlements, conversations)
                return

    # Orchestrator streaming
    if orchestrator is not None and orchestrator.is_llm_ready():
        full_text = await _stream_orchestrator(
            req, orchestrator, conversation_history,
        )
        if full_text:
            yield _sse_event({"type": "done", "text": full_text})
            await _persist_stream_turn(req, full_text, entitlements, conversations)
            return

    # Fallback
    fallback_resp = await synthesis.fallback("aucun module disponible")
    yield _sse_event({"type": "done", "text": fallback_resp.text, "degraded": True})


async def _stream_orchestrator(
    req: IncomingRequest,
    orchestrator: Orchestrator,
    conversation_history: list[dict[str, str]] | None,
) -> str | None:
    """Exécute l'orchestrateur en mode non-streaming (fallback SSE)."""
    try:
        return await orchestrator.run(
            req, conversation_history=conversation_history,
        )
    except Exception:
        logger.warning("stream orchestrator failed", exc_info=True)
        return None


async def _persist_stream_turn(
    req: IncomingRequest,
    text: str,
    entitlements: Entitlements | None,
    conversations: ConversationService | None,
) -> None:
    """Persiste le tour et consomme le quota."""
    if conversations is not None:
        async with guard("stream_persist", on_error=lambda: None):
            await conversations.append(req.user_id, "user", req.text)
            await conversations.append(req.user_id, "assistant", text)

    _exempt = bool(
        _GREETING_RE.search(req.text) or _ACK_RE.search(req.text) or _HELP_RE.search(req.text)
    )
    if entitlements is not None and not _exempt:
        async with guard("stream_consume", on_error=lambda: None):
            await entitlements.consume(req.user_id, "chat_message")


def _sse_event(data: dict[str, Any]) -> str:
    """Formate un événement SSE."""
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
