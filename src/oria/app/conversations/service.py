"""Service conversations — mémoire conversationnelle avec threads."""

from __future__ import annotations

import json
import logging
from typing import TYPE_CHECKING

from oria.app.conversations.models import ConversationWindow, Thread, ThreadSummary, Turn
from oria.app.conversations.repository import ConversationRepository
from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.kernel.models import Context
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class ConversationService:
    """Module conversations : fenêtre bornée + contexte persistant + threads."""

    name: str = "conversations"
    required: bool = False
    provides: tuple[str, ...] = ("conversations",)

    def __init__(self, db: Database, *, window_size: int = 20) -> None:
        self._repo = ConversationRepository(db)
        self._window_size = window_size

    async def start(self) -> None:
        logger.info("conversation service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    # -- threads --

    async def create_thread(
        self, user_id: str, title: str = "", context: dict[str, object] | None = None,
    ) -> Thread:
        ctx_json = json.dumps(context or {})
        return await self._repo.create_thread(
            user_id=user_id, title=title, context_json=ctx_json,
        )

    async def list_threads(self, user_id: str) -> list[ThreadSummary]:
        return await self._repo.list_threads(user_id)

    async def get_thread(self, thread_id: str) -> Thread | None:
        return await self._repo.get_thread(thread_id)

    async def delete_thread(self, thread_id: str) -> None:
        await self._repo.delete_thread(thread_id)

    async def update_thread_title(self, thread_id: str, title: str) -> None:
        await self._repo.update_thread(thread_id, title=title)

    # -- turns --

    async def append(
        self, user_id: str, role: str, text: str,
        thread_id: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> Turn:
        return await self._repo.append_turn(
            user_id=user_id, role=role, text=text,
            thread_id=thread_id, metadata=metadata,
        )

    async def recent(self, user_id: str, thread_id: str | None = None) -> list[Turn]:
        return await self._repo.recent(
            user_id, self._window_size, thread_id=thread_id,
        )

    async def get_window(
        self, user_id: str, thread_id: str | None = None,
    ) -> ConversationWindow:
        turns = await self.recent(user_id, thread_id=thread_id)
        ctx = await self._repo.get_context(user_id)
        return ConversationWindow(turns=turns, context=ctx)

    async def set_context(self, user_id: str, ctx: Context) -> None:
        await self._repo.set_context(user_id, ctx)

    async def get_context(self, user_id: str) -> Context:
        return await self._repo.get_context(user_id)

    async def clear(self, user_id: str) -> None:
        await self._repo.clear(user_id)
