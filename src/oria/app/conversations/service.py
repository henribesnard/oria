"""Service conversations — mémoire conversationnelle."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.app.conversations.models import ConversationWindow, Turn
from oria.app.conversations.repository import ConversationRepository
from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import Context

if TYPE_CHECKING:
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class ConversationService:
    """Module conversations : fenêtre bornée + contexte persistant."""

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

    async def append(
        self, user_id: str, role: str, text: str,
        metadata: dict[str, object] | None = None,
    ) -> Turn:
        return await self._repo.append_turn(
            user_id=user_id, role=role, text=text, metadata=metadata,
        )

    async def recent(self, user_id: str) -> list[Turn]:
        return await self._repo.recent(user_id, self._window_size)

    async def get_window(self, user_id: str) -> ConversationWindow:
        turns = await self.recent(user_id)
        ctx = await self._repo.get_context(user_id)
        return ConversationWindow(turns=turns, context=ctx)

    async def set_context(self, user_id: str, ctx: Context) -> None:
        await self._repo.set_context(user_id, ctx)

    async def get_context(self, user_id: str) -> Context:
        return await self._repo.get_context(user_id)

    async def clear(self, user_id: str) -> None:
        await self._repo.clear(user_id)
