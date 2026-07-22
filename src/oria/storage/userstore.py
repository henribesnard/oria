"""Stockage des préférences, mémoire de conversation et follows."""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class UserStore:
    """Module optionnel : préférences utilisateur."""

    name: str = "userstore"
    required: bool = False
    provides: tuple[str, ...] = ("user_memory",)

    def __init__(self, *, db: Database) -> None:
        self._db = db

    async def start(self) -> None:
        logger.info("userstore ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def get_prefs(self, user_id: str) -> dict[str, Any]:
        cursor = await self._db.conn.execute(
            "SELECT prefs FROM users WHERE user_id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return {}
        return json.loads(row[0])  # type: ignore[no-any-return]

    async def set_prefs(self, user_id: str, prefs: dict[str, Any]) -> None:
        now = time.time()
        await self._db.conn.execute(
            "INSERT INTO users (user_id, prefs, created_at, updated_at) "
            "VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "prefs = excluded.prefs, updated_at = excluded.updated_at",
            (user_id, json.dumps(prefs), now, now),
        )
        await self._db.conn.commit()

    async def get_follows(self, user_id: str) -> list[Any]:
        cursor = await self._db.conn.execute(
            "SELECT follows FROM users WHERE user_id = ?", (user_id,)
        )
        row = await cursor.fetchone()
        if row is None:
            return []
        return json.loads(row[0])  # type: ignore[no-any-return]
