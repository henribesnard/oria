"""BaseRepository — chemin cache-first générique."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.providers.apifootball.client import ApiFootballClient
    from oria.storage.cache import Cache, CacheEntry

logger = logging.getLogger(__name__)


class BaseRepository:
    """Repository cache-first : cache → fetch provider → cache périmé → erreur."""

    name: str = "base_repo"
    required: bool = False
    provides: tuple[str, ...] = ()
    volatility: str = "lent"

    def __init__(
        self,
        *,
        cache: Cache,
        domain: str,
        client: ApiFootballClient | None = None,
    ) -> None:
        self._cache = cache
        self._domain = domain
        self._client = client

    async def start(self) -> None:
        pass

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def get(self, key: str, *, allow_stale: bool = True) -> Any:  # noqa: ANN401
        """Chemin cache-first standard."""
        cache_key = f"{self._domain}:{key}"

        # 1) Lire le cache
        entry = await self._cache.get(cache_key, domain=self._domain, allow_stale=allow_stale)
        if entry is not None and entry.is_fresh:
            return entry.value

        # 2) Tenter un fetch frais via le provider
        try:
            fresh = await self._fetch(key)
            if fresh is not None:
                await self._cache.set(
                    cache_key,
                    fresh,
                    domain=self._domain,
                    volatility=self.volatility,
                )
                return fresh
        except Exception:
            logger.warning(
                "fetch failed, serving stale cache",
                extra={"repo": self.name, "key": key},
                exc_info=True,
            )

        # 3) Servir le cache périmé si disponible
        if entry is not None:
            return entry.value

        return None

    async def _fetch(self, key: str) -> Any:  # noqa: ANN401
        """À surcharger : fetch via le provider. Renvoie None si pas de données."""
        _ = key
        return None

    def _make_freshness(self, entry: CacheEntry | None) -> str | None:
        if entry is None:
            return None
        if entry.is_fresh:
            return None
        return f"à jour {entry.age_label}"
