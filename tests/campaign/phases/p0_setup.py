"""P0 — Setup : résolution saison, sanity check clé, budget restant.

Lancer : uv run python -m tests.campaign.phases.p0_setup
"""

from __future__ import annotations

import asyncio
import json
import logging
import sys

from oria.config import Settings
from oria.providers.apifootball.client import ApiFootballClient
from tests.campaign.seasons import resolve_seasons_batch

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
logger = logging.getLogger("p0_setup")

LEAGUE_IDS = {
    "Ligue 1": 61,
    "Premier League": 39,
    "La Liga": 140,
    "Serie A": 135,
    "Bundesliga": 78,
}


async def run() -> None:
    settings = Settings(
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        db_path=":memory:",
    )

    if not settings.apifootball_key:
        logger.error("APIFOOTBALL_KEY non configurée dans .env")
        sys.exit(1)

    client = ApiFootballClient(settings=settings)
    await client.start()

    try:
        # 1. Sanity check clé
        logger.info("=" * 60)
        logger.info("P0 — Sanity check API-Football")
        logger.info("=" * 60)

        raw = await client.fetch("/status")
        account = raw.get("response", {})
        if isinstance(account, dict):
            current = account.get("requests", {}).get("current", "?")
            limit = account.get("requests", {}).get("limit_day", "?")
            logger.info("Clé valide — %s/%s appels aujourd'hui", current, limit)
        else:
            logger.info("Réponse /status : %s", raw)

        # 2. Budget restant
        remaining = client.governor.remaining_budget
        logger.info("Budget restant (governor) : %d", remaining)

        # 3. Résolution des saisons
        logger.info("Résolution des saisons courantes...")
        league_ids = list(LEAGUE_IDS.values())
        seasons = await resolve_seasons_batch(client, league_ids)

        for name, lid in LEAGUE_IDS.items():
            s = seasons.get(lid, "?")
            logger.info("  %s (id=%d) → saison %s", name, lid, s)

        # 4. Résumé
        logger.info("=" * 60)
        logger.info("SETUP OK")
        logger.info("  Saisons : %s", json.dumps(seasons))
        logger.info("  Budget restant : %d", client.governor.remaining_budget)
        logger.info("  Appels consommés (setup) : %d", client.governor.calls_today)
        logger.info("=" * 60)

    finally:
        await client.stop()


if __name__ == "__main__":
    asyncio.run(run())
