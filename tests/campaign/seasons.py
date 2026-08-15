"""Résolution dynamique de la saison courante.

Interroge /leagues?id=X&current=true une seule fois, met le résultat en cache
disque (tests/campaign/.season_cache.json) et le réutilise partout.
Aucun test ne doit référencer une saison littérale.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

_CACHE_PATH = Path(__file__).parent / ".season_cache.json"
_CACHE_TTL = 86400  # 24h


def _load_cache() -> dict[str, Any]:
    if _CACHE_PATH.exists():
        try:
            data = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
            if time.time() - data.get("_ts", 0) < _CACHE_TTL:
                return data
        except (json.JSONDecodeError, KeyError):
            pass
    return {}


def _save_cache(data: dict[str, Any]) -> None:
    data["_ts"] = time.time()
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(
        json.dumps(data, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )


async def resolve_current_season(
    client: Any,
    league_id: int,
) -> int:
    """Résout la saison courante pour une ligue via /leagues?id=X&current=true.

    Résultat mis en cache disque pour éviter les appels répétés.
    """
    cache = _load_cache()
    key = f"season_{league_id}"
    if key in cache:
        season = int(cache[key])
        logger.info("season cache hit: league=%d → season=%d", league_id, season)
        return season

    # Appel API réel
    raw = await client.fetch("/leagues", {"id": league_id, "current": "true"})
    items = raw.get("response", [])
    if not items:
        msg = f"No current season found for league {league_id}"
        raise ValueError(msg)

    league_data = items[0]
    seasons = league_data.get("seasons", [])
    current = [s for s in seasons if s.get("current")]
    if not current:
        msg = f"No season marked 'current' for league {league_id}"
        raise ValueError(msg)

    season = int(current[0]["year"])
    cache[key] = season
    _save_cache(cache)
    logger.info("season resolved: league=%d → season=%d", league_id, season)
    return season


async def resolve_seasons_batch(
    client: Any,
    league_ids: list[int],
) -> dict[int, int]:
    """Résout la saison courante pour plusieurs ligues."""
    result: dict[int, int] = {}
    for lid in league_ids:
        result[lid] = await resolve_current_season(client, lid)
    return result
