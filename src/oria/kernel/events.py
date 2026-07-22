"""Bus d'événements interne (fire-and-forget)."""

from __future__ import annotations

import asyncio
import logging
from collections import defaultdict
from typing import Any

logger = logging.getLogger(__name__)

# Type d'un handler : async callable(event_data) -> None
type EventHandler = Any  # Callable[[Any], Awaitable[None]]


class EventBus:
    """Bus fan-out simple : publish émet sans attendre, les handlers sont isolés."""

    def __init__(self) -> None:
        self._handlers: dict[str, list[EventHandler]] = defaultdict(list)

    def subscribe(self, event_type: str, handler: EventHandler) -> None:
        self._handlers[event_type].append(handler)

    def publish(self, event_type: str, data: Any) -> None:  # noqa: ANN401
        """Émet un événement — fire-and-forget, ne lève jamais."""
        for handler in self._handlers.get(event_type, []):
            try:
                loop = asyncio.get_running_loop()
                loop.create_task(self._safe_call(handler, data))
            except RuntimeError:
                pass  # pas de boucle en cours → drop silencieux

    @staticmethod
    async def _safe_call(handler: EventHandler, data: Any) -> None:  # noqa: ANN401
        try:
            await handler(data)
        except Exception:
            logger.exception("event handler failed")
