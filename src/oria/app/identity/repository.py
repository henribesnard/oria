"""Couche d'accès données pour accounts + identities."""

from __future__ import annotations

import contextlib
import time
import uuid
from typing import TYPE_CHECKING

from oria.app.identity.models import Identity, User, UserRole, UserStatus

if TYPE_CHECKING:
    from oria.storage.db import Database


class IdentityRepository:
    """Opérations SQL sur accounts et identities."""

    def __init__(self, db: Database) -> None:
        self._db = db

    # -- accounts --

    async def create_user(
        self,
        *,
        display_name: str = "",
        locale: str = "fr",
        timezone: str = "Europe/Paris",
        role: UserRole = UserRole.USER,
    ) -> User:
        now = time.time()
        user_id = uuid.uuid4().hex
        await self._db.conn.execute(
            "INSERT INTO accounts (id, status, role, display_name, locale, timezone, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (user_id, UserStatus.ACTIVE, role, display_name, locale, timezone, now),
        )
        await self._db.conn.commit()
        return User(
            id=user_id,
            status=UserStatus.ACTIVE,
            role=role,
            display_name=display_name,
            locale=locale,
            timezone=timezone,
            created_at=now,
        )

    async def get_user(self, user_id: str) -> User | None:
        cursor = await self._db.conn.execute(
            "SELECT id, status, role, display_name, locale, timezone, created_at, deleted_at "
            "FROM accounts WHERE id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return User(
            id=row[0],
            status=UserStatus(row[1]),
            role=UserRole(row[2]),
            display_name=row[3],
            locale=row[4],
            timezone=row[5],
            created_at=row[6],
            deleted_at=row[7],
        )

    async def update_user(self, user_id: str, **fields: object) -> User | None:
        allowed = {"display_name", "locale", "timezone", "status", "role"}
        updates = {k: v for k, v in fields.items() if k in allowed and v is not None}
        if not updates:
            return await self.get_user(user_id)
        set_clause = ", ".join(f"{k} = ?" for k in updates)
        values = [*updates.values(), user_id]
        await self._db.conn.execute(
            f"UPDATE accounts SET {set_clause} WHERE id = ?",  # noqa: S608
            values,
        )
        await self._db.conn.commit()
        return await self.get_user(user_id)

    async def delete_user(self, user_id: str) -> None:
        """Purge RGPD : supprime le compte et toutes les données liées."""
        now = time.time()
        # Marquer comme deleted + anonymiser
        await self._db.conn.execute(
            "UPDATE accounts SET status = ?, display_name = '', deleted_at = ? WHERE id = ?",
            (UserStatus.DELETED, now, user_id),
        )
        # Supprimer les identités (CASCADE devrait le faire, mais explicite)
        await self._db.conn.execute("DELETE FROM identities WHERE user_id = ?", (user_id,))
        # Purger les données liées si les tables existent
        for table in (
            "credentials", "sessions", "tokens",
            "subscriptions", "billing_events", "usage_counters",
            "follows", "notification_settings",
            "conversations", "active_context",
        ):
            with contextlib.suppress(Exception):  # noqa: BLE001
                await self._db.conn.execute(f"DELETE FROM {table} WHERE user_id = ?", (user_id,))  # noqa: S608
        # Purger l'ancienne table users (userstore)
        with contextlib.suppress(Exception):  # noqa: BLE001
            await self._db.conn.execute("DELETE FROM users WHERE user_id = ?", (user_id,))
        await self._db.conn.commit()

    async def list_users(
        self,
        *,
        search: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[User]:
        if search:
            cursor = await self._db.conn.execute(
                "SELECT id, status, role, display_name, locale, timezone, created_at, deleted_at "
                "FROM accounts WHERE display_name LIKE ? OR id LIKE ? "
                "ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (f"%{search}%", f"%{search}%", limit, offset),
            )
        else:
            cursor = await self._db.conn.execute(
                "SELECT id, status, role, display_name, locale, timezone, created_at, deleted_at "
                "FROM accounts ORDER BY created_at DESC LIMIT ? OFFSET ?",
                (limit, offset),
            )
        rows = await cursor.fetchall()
        return [
            User(
                id=r[0], status=UserStatus(r[1]), role=UserRole(r[2]),
                display_name=r[3], locale=r[4], timezone=r[5],
                created_at=r[6], deleted_at=r[7],
            )
            for r in rows
        ]

    async def count_users(self) -> int:
        cursor = await self._db.conn.execute(
            "SELECT COUNT(*) FROM accounts WHERE status != ?",
            (UserStatus.DELETED,),
        )
        row = await cursor.fetchone()
        return row[0] if row else 0

    # -- identities --

    async def create_identity(
        self, *, user_id: str, provider: str, external_id: str
    ) -> Identity:
        now = time.time()
        identity_id = uuid.uuid4().hex
        await self._db.conn.execute(
            "INSERT INTO identities (id, user_id, provider, external_id, created_at) "
            "VALUES (?, ?, ?, ?, ?)",
            (identity_id, user_id, provider, external_id, now),
        )
        await self._db.conn.commit()
        return Identity(
            id=identity_id,
            user_id=user_id,
            provider=provider,
            external_id=external_id,
            created_at=now,
        )

    async def find_identity(self, provider: str, external_id: str) -> Identity | None:
        cursor = await self._db.conn.execute(
            "SELECT id, user_id, provider, external_id, created_at "
            "FROM identities WHERE provider = ? AND external_id = ?",
            (provider, external_id),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return Identity(
            id=row[0], user_id=row[1], provider=row[2],
            external_id=row[3], created_at=row[4],
        )

    async def list_identities(self, user_id: str) -> list[Identity]:
        cursor = await self._db.conn.execute(
            "SELECT id, user_id, provider, external_id, created_at "
            "FROM identities WHERE user_id = ?",
            (user_id,),
        )
        rows = await cursor.fetchall()
        return [
            Identity(id=r[0], user_id=r[1], provider=r[2], external_id=r[3], created_at=r[4])
            for r in rows
        ]

    async def delete_identity(self, user_id: str, provider: str) -> bool:
        cursor = await self._db.conn.execute(
            "DELETE FROM identities WHERE user_id = ? AND provider = ?",
            (user_id, provider),
        )
        await self._db.conn.commit()
        return cursor.rowcount > 0
