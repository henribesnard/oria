"""Connexion SQLite async + runner de migrations."""

from __future__ import annotations

import logging
import time
from pathlib import Path

import aiosqlite

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)

_MIGRATIONS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "migrations"


class Database:
    """Module requis : connexion SQLite + migrations."""

    name: str = "db"
    required: bool = True
    provides: tuple[str, ...] = ("database",)

    def __init__(self, *, db_path: str) -> None:
        self._db_path = db_path
        self._conn: aiosqlite.Connection | None = None

    @property
    def conn(self) -> aiosqlite.Connection:
        if self._conn is None:
            raise RuntimeError("database not started")
        return self._conn

    async def start(self) -> None:
        self._conn = await aiosqlite.connect(self._db_path)
        await self._conn.execute("PRAGMA journal_mode=WAL")
        await self._run_migrations()
        logger.info("database ready", extra={"db_path": self._db_path})

    async def stop(self) -> None:
        if self._conn:
            await self._conn.close()
            self._conn = None

    async def health(self) -> ModuleStatus:
        if self._conn is None:
            return ModuleStatus(name=self.name, availability=Availability.DOWN)
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def _run_migrations(self) -> None:
        """Applique les fichiers SQL non encore appliqués."""
        conn = self.conn
        # S'assurer que la table migrations existe
        await conn.execute(
            "CREATE TABLE IF NOT EXISTS migrations "
            "(id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, applied_at REAL NOT NULL)"
        )
        await conn.commit()

        # Lister les migrations déjà appliquées
        cursor = await conn.execute("SELECT name FROM migrations")
        applied = {row[0] for row in await cursor.fetchall()}

        # Trouver et appliquer les nouvelles migrations
        if not _MIGRATIONS_DIR.exists():
            return

        sql_files = sorted(_MIGRATIONS_DIR.glob("*.sql"))
        for sql_file in sql_files:
            if sql_file.name in applied:
                continue
            sql = sql_file.read_text(encoding="utf-8")
            await conn.executescript(sql)
            await conn.execute(
                "INSERT INTO migrations (name, applied_at) VALUES (?, ?)",
                (sql_file.name, time.time()),
            )
            await conn.commit()
            logger.info("migration applied", extra={"migration": sql_file.name})
