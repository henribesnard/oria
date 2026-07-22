"""Primitives de traçage — instrumentation quasi gratuite.

Émet des spans fire-and-forget sur le bus d'événements.
Ne lève jamais, n'attend rien.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager
from contextvars import ContextVar
from dataclasses import dataclass, field
from functools import wraps
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from oria.kernel.events import EventBus

logger = logging.getLogger(__name__)

# -- Context propagation via contextvars --

_current_trace: ContextVar[TraceContext | None] = ContextVar("_current_trace", default=None)


@dataclass
class TraceContext:
    """Contexte de trace propagé implicitement."""

    trace_id: str
    parent_span_id: str | None = None
    bus: EventBus | None = None


@dataclass
class Span:
    """Un span d'instrumentation."""

    trace_id: str
    span_id: str = field(default_factory=lambda: uuid.uuid4().hex[:16])
    parent_id: str | None = None
    name: str = ""
    start_ms: float = 0.0
    duration_ms: float | None = None
    status: str = "ok"
    attrs: dict[str, Any] = field(default_factory=dict)


def current_trace() -> TraceContext | None:
    return _current_trace.get()


def new_trace(bus: EventBus | None = None) -> TraceContext:
    ctx = TraceContext(trace_id=uuid.uuid4().hex, bus=bus)
    _current_trace.set(ctx)
    return ctx


@asynccontextmanager
async def span(name: str, *, attrs: dict[str, Any] | None = None) -> AsyncIterator[Span]:
    """Ouvre un span, mesure la durée (horloge monotone), émet sur le bus."""
    ctx = _current_trace.get()
    trace_id = ctx.trace_id if ctx else uuid.uuid4().hex
    parent_id = ctx.parent_span_id if ctx else None

    s = Span(
        trace_id=trace_id,
        parent_id=parent_id,
        name=name,
        start_ms=time.monotonic() * 1000,
        attrs=dict(attrs) if attrs else {},
    )

    # Pousser ce span comme parent pour les sous-spans
    token = None
    if ctx:
        new_ctx = TraceContext(trace_id=ctx.trace_id, parent_span_id=s.span_id, bus=ctx.bus)
        token = _current_trace.set(new_ctx)

    try:
        yield s
    except Exception:
        s.status = "error"
        raise
    finally:
        s.duration_ms = time.monotonic() * 1000 - s.start_ms
        # Restaurer le contexte parent
        if token is not None and ctx is not None:
            _current_trace.set(ctx)
        # Émettre fire-and-forget
        _emit(s)


def _emit(s: Span) -> None:
    """Émet le span sur le bus — ne lève jamais."""
    try:
        ctx = _current_trace.get()
        bus = ctx.bus if ctx else None
        if bus is not None:
            from dataclasses import asdict

            bus.publish("span", asdict(s))
    except Exception:
        logger.debug("span emit failed", exc_info=True)


def traced(name: str) -> Any:  # noqa: ANN401
    """Décorateur : instrumente une coroutine en une ligne."""

    def decorator(fn: Any) -> Any:  # noqa: ANN401
        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
            async with span(name):
                return await fn(*args, **kwargs)

        return wrapper

    return decorator
