"""Couche d'accès données pour credentials, sessions, tokens."""

from __future__ import annotations

import time
import uuid
from typing import TYPE_CHECKING

from oria.app.auth.models import Credential, Session

if TYPE_CHECKING:
    from oria.storage.db import Database


class AuthRepository:
    """Opérations SQL pour l'authentification."""

    def __init__(self, db: Database) -> None:
        self._db = db

    # -- credentials --

    async def create_credential(
        self, *, user_id: str, email: str, password_hash: str,
    ) -> Credential:
        now = time.time()
        await self._db.conn.execute(
            "INSERT INTO credentials (user_id, email, password_hash, email_verified, created_at) "
            "VALUES (?, ?, ?, 0, ?)",
            (user_id, email.lower().strip(), password_hash, now),
        )
        await self._db.conn.commit()
        return Credential(
            user_id=user_id, email=email.lower().strip(),
            password_hash=password_hash, created_at=now,
        )

    async def get_credential_by_email(self, email: str) -> Credential | None:
        cursor = await self._db.conn.execute(
            "SELECT user_id, email, password_hash, email_verified, created_at "
            "FROM credentials WHERE email = ?",
            (email.lower().strip(),),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return Credential(
            user_id=row[0], email=row[1], password_hash=row[2],
            email_verified=bool(row[3]), created_at=row[4],
        )

    async def get_credential_by_user(self, user_id: str) -> Credential | None:
        cursor = await self._db.conn.execute(
            "SELECT user_id, email, password_hash, email_verified, created_at "
            "FROM credentials WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return Credential(
            user_id=row[0], email=row[1], password_hash=row[2],
            email_verified=bool(row[3]), created_at=row[4],
        )

    async def verify_email(self, user_id: str) -> None:
        await self._db.conn.execute(
            "UPDATE credentials SET email_verified = 1 WHERE user_id = ?",
            (user_id,),
        )
        await self._db.conn.commit()

    async def update_password(self, user_id: str, password_hash: str) -> None:
        await self._db.conn.execute(
            "UPDATE credentials SET password_hash = ? WHERE user_id = ?",
            (password_hash, user_id),
        )
        await self._db.conn.commit()

    # -- sessions --

    async def create_session(
        self,
        *,
        user_id: str,
        refresh_token_hash: str,
        user_agent: str = "",
        ip: str = "",
        ttl_days: int = 7,
    ) -> Session:
        now = time.time()
        session_id = uuid.uuid4().hex
        expires_at = now + ttl_days * 86400
        await self._db.conn.execute(
            "INSERT INTO sessions (id, user_id, refresh_token_hash, user_agent, ip, "
            "expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (session_id, user_id, refresh_token_hash, user_agent, ip, expires_at, now),
        )
        await self._db.conn.commit()
        return Session(
            id=session_id, user_id=user_id, refresh_token_hash=refresh_token_hash,
            user_agent=user_agent, ip=ip, expires_at=expires_at, created_at=now,
        )

    async def find_session_by_refresh(self, refresh_token_hash: str) -> Session | None:
        cursor = await self._db.conn.execute(
            "SELECT id, user_id, refresh_token_hash, user_agent, ip, expires_at, "
            "revoked_at, created_at FROM sessions WHERE refresh_token_hash = ?",
            (refresh_token_hash,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return Session(
            id=row[0], user_id=row[1], refresh_token_hash=row[2],
            user_agent=row[3], ip=row[4], expires_at=row[5],
            revoked_at=row[6], created_at=row[7],
        )

    async def revoke_session(self, session_id: str) -> None:
        await self._db.conn.execute(
            "UPDATE sessions SET revoked_at = ? WHERE id = ?",
            (time.time(), session_id),
        )
        await self._db.conn.commit()

    async def revoke_all_sessions(self, user_id: str) -> None:
        await self._db.conn.execute(
            "UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
            (time.time(), user_id),
        )
        await self._db.conn.commit()

    # -- tokens (email_verify, password_reset) --

    async def create_token(
        self,
        *,
        user_id: str,
        kind: str,
        token_hash: str,
        ttl_seconds: int = 3600,
    ) -> str:
        now = time.time()
        token_id = uuid.uuid4().hex
        await self._db.conn.execute(
            "INSERT INTO tokens (id, user_id, kind, token_hash, expires_at, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (token_id, user_id, kind, token_hash, now + ttl_seconds, now),
        )
        await self._db.conn.commit()
        return token_id

    async def use_token(self, token_hash: str, kind: str) -> str | None:
        """Consomme un token à usage unique. Renvoie le user_id ou None."""
        now = time.time()
        cursor = await self._db.conn.execute(
            "SELECT id, user_id FROM tokens "
            "WHERE token_hash = ? AND kind = ? AND expires_at > ? AND used_at IS NULL",
            (token_hash, kind, now),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        await self._db.conn.execute(
            "UPDATE tokens SET used_at = ? WHERE id = ?",
            (now, row[0]),
        )
        await self._db.conn.commit()
        return row[1]
