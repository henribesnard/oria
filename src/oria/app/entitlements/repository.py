"""Couche d’accès données pour usage_counters."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from oria.storage.db import Database


class EntitlementsRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    async def get_usage(self, user_id: str, day: str, feature: str) -> int:
        cursor = await self._db.conn.execute(
            "SELECT count FROM usage_counters WHERE user_id = ? AND day = ? AND feature = ?",
            (user_id, day, feature),
        )
        row = await cursor.fetchone()
        return row[0] if row else 0

    async def increment(self, user_id: str, day: str, feature: str, n: int = 1) -> int:
        await self._db.conn.execute(
            "INSERT INTO usage_counters (user_id, day, feature, count) VALUES (?, ?, ?, ?) "
            "ON CONFLICT(user_id, day, feature) DO UPDATE SET count = count + ?",
            (user_id, day, feature, n, n),
        )
        await self._db.conn.commit()
        cursor = await self._db.conn.execute(
            "SELECT count FROM usage_counters WHERE user_id = ? AND day = ? AND feature = ?",
            (user_id, day, feature),
        )
        row = await cursor.fetchone()
        return row[0] if row else n

    async def get_all_usage(self, user_id: str, day: str) -> dict[str, int]:
        cursor = await self._db.conn.execute(
            "SELECT feature, count FROM usage_counters WHERE user_id = ? AND day = ?",
            (user_id, day),
        )
        rows = await cursor.fetchall()
        return {r[0]: r[1] for r in rows}

    @staticmethod
    def today() -> str:
        return datetime.now(tz=UTC).strftime("%Y-%m-%d")
