"""Couche d'accès données pour follows et notification_settings."""

from __future__ import annotations

import time
import uuid
from typing import TYPE_CHECKING

from oria.app.preferences.models import Follow, NotificationSettings

if TYPE_CHECKING:
    from oria.storage.db import Database


class PreferencesRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    # -- follows --

    async def add_follow(
        self, *, user_id: str, entity_type: str, entity_id: int,
        entity_name: str = "", logo_url: str = "",
    ) -> Follow:
        now = time.time()
        follow_id = uuid.uuid4().hex
        try:
            await self._db.conn.execute(
                "INSERT INTO follows "
                "(id, user_id, entity_type, entity_id, entity_name, logo_url, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (follow_id, user_id, entity_type, entity_id, entity_name, logo_url, now),
            )
            await self._db.conn.commit()
        except Exception:  # noqa: BLE001
            # UNIQUE constraint → déjà suivi, idempotent
            cursor = await self._db.conn.execute(
                "SELECT id, user_id, entity_type, entity_id, entity_name, logo_url, created_at "
                "FROM follows WHERE user_id = ? AND entity_type = ? AND entity_id = ?",
                (user_id, entity_type, entity_id),
            )
            row = await cursor.fetchone()
            if row:
                return Follow(
                    id=row[0], user_id=row[1], entity_type=row[2],
                    entity_id=row[3], entity_name=row[4], logo_url=row[5],
                    created_at=row[6],
                )
        return Follow(
            id=follow_id, user_id=user_id, entity_type=entity_type,
            entity_id=entity_id, entity_name=entity_name, logo_url=logo_url,
            created_at=now,
        )

    async def remove_follow(
        self, user_id: str, entity_type: str, entity_id: int,
    ) -> bool:
        cursor = await self._db.conn.execute(
            "DELETE FROM follows WHERE user_id = ? AND entity_type = ? AND entity_id = ?",
            (user_id, entity_type, entity_id),
        )
        await self._db.conn.commit()
        return cursor.rowcount > 0

    async def list_follows(
        self, user_id: str, entity_type: str | None = None,
    ) -> list[Follow]:
        if entity_type:
            cursor = await self._db.conn.execute(
                "SELECT id, user_id, entity_type, entity_id, entity_name, logo_url, created_at "
                "FROM follows WHERE user_id = ? AND entity_type = ? ORDER BY created_at DESC",
                (user_id, entity_type),
            )
        else:
            cursor = await self._db.conn.execute(
                "SELECT id, user_id, entity_type, entity_id, entity_name, logo_url, created_at "
                "FROM follows WHERE user_id = ? ORDER BY created_at DESC",
                (user_id,),
            )
        rows = await cursor.fetchall()
        return [
            Follow(id=r[0], user_id=r[1], entity_type=r[2],
                   entity_id=r[3], entity_name=r[4], logo_url=r[5],
                   created_at=r[6])
            for r in rows
        ]

    async def aggregated_follows(self) -> dict[str, list[int]]:
        """Union de tous les follows tous utilisateurs confondus."""
        result: dict[str, list[int]] = {"league": [], "team": [], "player": []}
        cursor = await self._db.conn.execute(
            "SELECT DISTINCT entity_type, entity_id FROM follows",
        )
        rows = await cursor.fetchall()
        for r in rows:
            if r[0] in result:
                result[r[0]].append(r[1])
        return result

    # -- notification_settings --

    async def get_notification_settings(self, user_id: str) -> NotificationSettings:
        cursor = await self._db.conn.execute(
            "SELECT user_id, prematch, result, lineup, live_goal, digest, "
            "quiet_start, quiet_end, timezone, updated_at "
            "FROM notification_settings WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return NotificationSettings(user_id=user_id, updated_at=time.time())
        return NotificationSettings(
            user_id=row[0], prematch=bool(row[1]), result=bool(row[2]),
            lineup=bool(row[3]), live_goal=bool(row[4]), digest=bool(row[5]),
            quiet_start=row[6], quiet_end=row[7], timezone=row[8], updated_at=row[9],
        )

    async def upsert_notification_settings(self, ns: NotificationSettings) -> None:
        now = time.time()
        await self._db.conn.execute(
            "INSERT INTO notification_settings "
            "(user_id, prematch, result, lineup, live_goal, digest, "
            "quiet_start, quiet_end, timezone, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "prematch=excluded.prematch, result=excluded.result, "
            "lineup=excluded.lineup, live_goal=excluded.live_goal, "
            "digest=excluded.digest, quiet_start=excluded.quiet_start, "
            "quiet_end=excluded.quiet_end, timezone=excluded.timezone, "
            "updated_at=excluded.updated_at",
            (ns.user_id, int(ns.prematch), int(ns.result), int(ns.lineup),
             int(ns.live_goal), int(ns.digest), ns.quiet_start, ns.quiet_end,
             ns.timezone, now),
        )
        await self._db.conn.commit()

    _SUBSCRIBER_COLUMNS = frozenset({"prematch", "result", "lineup", "live_goal", "digest"})

    async def get_subscribers(self, event_type: str) -> list[NotificationSettings]:
        """Tous les users abonnés à un type d'événement."""
        if event_type not in self._SUBSCRIBER_COLUMNS:
            return []
        cursor = await self._db.conn.execute(
            f"SELECT user_id, prematch, result, lineup, live_goal, digest, "
            f"quiet_start, quiet_end, timezone, updated_at "
            f"FROM notification_settings WHERE {event_type} = 1",
        )
        rows = await cursor.fetchall()
        return [
            NotificationSettings(
                user_id=r[0], prematch=bool(r[1]), result=bool(r[2]),
                lineup=bool(r[3]), live_goal=bool(r[4]), digest=bool(r[5]),
                quiet_start=r[6], quiet_end=r[7], timezone=r[8], updated_at=r[9],
            )
            for r in rows
        ]
