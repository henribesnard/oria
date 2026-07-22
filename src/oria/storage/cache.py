"""Cache clé/valeur avec fetched_at, TTL et classe de volatilité."""

from __future__ import annotations

import json
import logging
import time
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.storage.db import Database

logger = logging.getLogger(__name__)

# TTL par classe de volatilité (en secondes)
VOLATILITY_TTL: dict[str, float] = {
    "immuable": 86400 * 30,  # 30 jours
    "lent": 3600,  # 1 heure
    "semi_rapide": 300,  # 5 minutes
    "live": 30,  # 30 secondes
}


class CacheEntry:
    """Entrée de cache avec métadonnées de fraîcheur."""

    def __init__(
        self,
        key: str,
        value: Any,  # noqa: ANN401
        *,
        domain: str,
        fetched_at: float,
        ttl_seconds: float,
    ) -> None:
        self.key = key
        self.value = value
        self.domain = domain
        self.fetched_at = fetched_at
        self.ttl_seconds = ttl_seconds

    @property
    def is_fresh(self) -> bool:
        return (time.time() - self.fetched_at) < self.ttl_seconds

    @property
    def age_label(self) -> str:
        age = time.time() - self.fetched_at
        if age < 60:
            return "à l'instant"
        if age < 3600:
            return f"il y a {int(age // 60)} min"
        return f"il y a {int(age // 3600)} h"


class Cache:
    """Module requis : cache clé/valeur SQLite."""

    name: str = "cache"
    required: bool = True
    provides: tuple[str, ...] = ("cache",)

    def __init__(self, *, db: Database) -> None:
        self._db = db

    async def start(self) -> None:
        logger.info("cache ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def get(
        self,
        key: str,
        *,
        domain: str = "",
        allow_stale: bool = True,
    ) -> CacheEntry | None:
        """Récupère une entrée. Renvoie None si absente (ou expirée sans allow_stale)."""
        cursor = await self._db.conn.execute(
            "SELECT value, domain, fetched_at, ttl_seconds FROM cache WHERE key = ?",
            (key,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None

        entry = CacheEntry(
            key=key,
            value=json.loads(row[0]),
            domain=row[1],
            fetched_at=row[2],
            ttl_seconds=row[3],
        )

        if not entry.is_fresh and not allow_stale:
            return None
        return entry

    async def set(
        self,
        key: str,
        value: Any,  # noqa: ANN401
        *,
        domain: str = "",
        volatility: str = "lent",
        ttl_seconds: float | None = None,
    ) -> None:
        """Écrit ou met à jour une entrée."""
        ttl = ttl_seconds if ttl_seconds is not None else VOLATILITY_TTL.get(volatility, 3600)
        await self._db.conn.execute(
            "INSERT OR REPLACE INTO cache "
            "(key, value, domain, volatility, fetched_at, ttl_seconds) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (key, json.dumps(value), domain, volatility, time.time(), ttl),
        )
        await self._db.conn.commit()

    async def delete(self, key: str) -> None:
        await self._db.conn.execute("DELETE FROM cache WHERE key = ?", (key,))
        await self._db.conn.commit()
