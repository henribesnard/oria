"""Couche d'accès données pour conversations, threads et active_context."""

from __future__ import annotations

import json
import time
import uuid
from typing import TYPE_CHECKING

from oria.app.conversations.models import Thread, ThreadSummary, Turn
from oria.kernel.models import Context

if TYPE_CHECKING:
    from oria.storage.db import Database


class ConversationRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    # -- threads --

    async def create_thread(
        self, *, user_id: str, title: str = "", context_json: str = "{}",
    ) -> Thread:
        now = time.time()
        thread_id = uuid.uuid4().hex[:16]
        await self._db.conn.execute(
            "INSERT INTO threads (id, user_id, title, context, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (thread_id, user_id, title, context_json, now, now),
        )
        await self._db.conn.commit()
        ctx = json.loads(context_json) if context_json else {}
        return Thread(
            id=thread_id, user_id=user_id, title=title,
            context=ctx, created_at=now, updated_at=now,
        )

    async def list_threads(self, user_id: str, limit: int = 50) -> list[ThreadSummary]:
        cursor = await self._db.conn.execute(
            "SELECT t.id, t.title, t.context, t.updated_at, "
            "  (SELECT c.text FROM conversations c "
            "   WHERE c.thread_id = t.id ORDER BY c.created_at DESC LIMIT 1) "
            "FROM threads t WHERE t.user_id = ? "
            "ORDER BY t.updated_at DESC LIMIT ?",
            (user_id, limit),
        )
        rows = await cursor.fetchall()
        results = []
        for r in rows:
            ctx = json.loads(r[2]) if r[2] else {}
            results.append(ThreadSummary(
                id=r[0], title=r[1], context=ctx,
                last_message=r[4] or "", updated_at=r[3],
            ))
        return results

    async def get_thread(self, thread_id: str) -> Thread | None:
        cursor = await self._db.conn.execute(
            "SELECT id, user_id, title, context, created_at, updated_at "
            "FROM threads WHERE id = ?",
            (thread_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        ctx = json.loads(row[3]) if row[3] else {}
        return Thread(
            id=row[0], user_id=row[1], title=row[2],
            context=ctx, created_at=row[4], updated_at=row[5],
        )

    async def delete_thread(self, thread_id: str) -> None:
        await self._db.conn.execute(
            "DELETE FROM conversations WHERE thread_id = ?", (thread_id,),
        )
        await self._db.conn.execute(
            "DELETE FROM threads WHERE id = ?", (thread_id,),
        )
        await self._db.conn.commit()

    async def update_thread(
        self, thread_id: str, *, title: str | None = None,
    ) -> None:
        now = time.time()
        if title is not None:
            await self._db.conn.execute(
                "UPDATE threads SET title = ?, updated_at = ? WHERE id = ?",
                (title, now, thread_id),
            )
        else:
            await self._db.conn.execute(
                "UPDATE threads SET updated_at = ? WHERE id = ?",
                (now, thread_id),
            )
        await self._db.conn.commit()

    # -- turns --

    async def append_turn(
        self, *, user_id: str, role: str, text: str,
        thread_id: str | None = None,
        metadata: dict[str, object] | None = None,
    ) -> Turn:
        now = time.time()
        meta_json = json.dumps(metadata or {})
        cursor = await self._db.conn.execute(
            "INSERT INTO conversations (user_id, role, text, metadata, created_at, thread_id) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (user_id, role, text, meta_json, now, thread_id),
        )
        await self._db.conn.commit()
        # Touch thread updated_at
        if thread_id:
            await self._db.conn.execute(
                "UPDATE threads SET updated_at = ? WHERE id = ?",
                (now, thread_id),
            )
            await self._db.conn.commit()
        return Turn(
            id=cursor.lastrowid or 0, user_id=user_id,
            role=role, text=text, metadata=metadata or {}, created_at=now,
        )

    async def recent(
        self, user_id: str, limit: int = 20, thread_id: str | None = None,
    ) -> list[Turn]:
        if thread_id:
            cursor = await self._db.conn.execute(
                "SELECT id, user_id, role, text, metadata, created_at "
                "FROM conversations WHERE thread_id = ? "
                "ORDER BY created_at DESC LIMIT ?",
                (thread_id, limit),
            )
        else:
            cursor = await self._db.conn.execute(
                "SELECT id, user_id, role, text, metadata, created_at "
                "FROM conversations WHERE user_id = ? "
                "ORDER BY created_at DESC LIMIT ?",
                (user_id, limit),
            )
        rows = await cursor.fetchall()
        turns = []
        for r in reversed(list(rows)):
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
            "INSERT INTO active_context (user_id, context, updated_at) "
            "VALUES (?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "context=excluded.context, updated_at=excluded.updated_at",
            (user_id, ctx_json, now),
        )
        await self._db.conn.commit()
