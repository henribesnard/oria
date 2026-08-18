"""Outbound port SSE — push notifications vers les clients web connectés."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

logger = logging.getLogger(__name__)


class SSEOutboundPort:
    """Gère les connexions SSE actives et push les notifications en temps réel."""

    def __init__(self) -> None:
        self._connections: dict[str, list[asyncio.Queue[str]]] = {}

    def subscribe(self, user_id: str) -> asyncio.Queue[str]:
        """Enregistre une connexion SSE pour un utilisateur."""
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=50)
        if user_id not in self._connections:
            self._connections[user_id] = []
        self._connections[user_id].append(queue)
        logger.debug(
            "SSE subscriber added for user %s (total: %d)",
            user_id,
            len(self._connections[user_id]),
        )
        return queue

    def unsubscribe(self, user_id: str, queue: asyncio.Queue[str]) -> None:
        """Retire une connexion SSE."""
        conns = self._connections.get(user_id, [])
        if queue in conns:
            conns.remove(queue)
        if not conns:
            self._connections.pop(user_id, None)

    async def send(self, user_id: str, event_type: str, message: str) -> None:
        """Push un événement vers toutes les connexions SSE de l'utilisateur."""
        conns = self._connections.get(user_id, [])
        if not conns:
            return

        data = json.dumps({
            "type": event_type,
            "message": message,
        }, ensure_ascii=False)
        sse_event = f"event: notification\ndata: {data}\n\n"

        dead: list[asyncio.Queue[str]] = []
        for queue in conns:
            try:
                queue.put_nowait(sse_event)
            except asyncio.QueueFull:
                dead.append(queue)
                logger.debug("SSE queue full for user %s, dropping", user_id)

        # Nettoyer les queues mortes
        for q in dead:
            if q in conns:
                conns.remove(q)

    async def stream(self, user_id: str) -> AsyncIterator[str]:
        """Génère un flux SSE pour un utilisateur connecté."""
        queue = self.subscribe(user_id)
        try:
            # Envoyer un heartbeat initial
            yield "event: connected\ndata: {}\n\n"
            while True:
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=30)
                    yield event
                except TimeoutError:
                    # Heartbeat pour maintenir la connexion
                    yield ": heartbeat\n\n"
        finally:
            self.unsubscribe(user_id, queue)

    @property
    def active_connections(self) -> int:
        return sum(len(v) for v in self._connections.values())
