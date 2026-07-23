"""Couche d'accès données pour conversations et active_context."""

from __future__ import annotations

import json
import time
from typing import TYPE_CHECKING

from oria.app.conversations.models import Turn
from oria.kernel.models import Context

if TYPE_CHECKING:
    from oria.storage.db import Database


class ConversationRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    async def append_turn(
        self, *, user_id: str, role: str, text: str, metadata: dict[str, object] | None = None,
    ) -> Turn:
        now = time.time()
        meta_json = json.dumps(metadata or {})
        cursor = await self._db.conn.execute(
            "INSERT INTO conversations (user_id, role, text, metadata, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (user_id, role, text, meta_json, now),
        )
        await self._db.conn.commit()
        return Turn(
            id=cursor.lastrowid or 0, user_id=user_id,
            role=role, text=text, metadata=metadata or {}, created_at=now,
        )

    async def recent(self, user_id: str, limit: int = 20) -> list[Turn]:
        cursor = await self._db.conn.execute(
            "SELECT id, user_id, role, text, metadata, created_at "
            "FROM conversations WHERE user_id = ? "
            "ORDER BY created_at DESC LIMIT ?",
            (user_id, limit),
        )
        rows = await cursor.fetchall()
        turns = []
        for r in reversed(rows):  # Remettre dans l'ordre chronologique
            meta = json.loads(r[4]) if r[4] else {}
            turns.append(Turn(
                id=r[0], user_id=r[1], role=r[2],
                text=r[3], metadata=meta, created_at=r[5],
            ))
        return turns

    async def clear(self, user_id: str) -> None:
        await self._db.conn.execute(
            "DELETE FROM conversations WHERE user_id = ?", (user_id,),
        )
        await self._db.conn.commit()

    # -- active_context --

    async def get_context(self, user_id: str) -> Context:
        cursor = await self._db.conn.execute(
            "SELECT context FROM active_context WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return Context()
        return Context.model_validate_json(row[0])

    async def set_context(self, user_id: str, ctx: Context) -> None:
        now = time.time()
        ctx_json = ctx.model_dump_json()
        await self._db.conn.execute(
            "INSERT INTO active_context (user_id, context, updated_at) VALUES (?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET context=excluded.context, updated_at=excluded.updated_at",
            (user_id, ctx_json, now),
        )
        await self._db.conn.commit()
