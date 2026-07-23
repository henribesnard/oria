"""Jobs d'ingestion — fonctions unitaires de pré-fetch."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from oria.domain.fixtures import FixturesRepository
    from oria.domain.standings import StandingsRepository

logger = logging.getLogger(__name__)


async def refresh_standings(
    standings: StandingsRepository,
    league_ids: list[int],
) -> int:
    """Rafraîchit les classements pour les ligues suivies. Renvoie le nombre de succès."""
    success = 0
    for league_id in league_ids:
        try:
            await standings.get(f"league={league_id}", allow_stale=False)
            success += 1
        except Exception:
            logger.warning("refresh_standings failed for league %d", league_id, exc_info=True)
    return success


async def refresh_fixtures(
    fixtures: FixturesRepository,
    league_ids: list[int],
    *,
    next_count: int = 10,
) -> int:
    """Rafraîchit les prochains matchs pour les ligues suivies."""
    success = 0
    for league_id in league_ids:
        try:
            await fixtures.get(f"league={league_id}&next={next_count}", allow_stale=False)
            success += 1
        except Exception:
            logger.warning("refresh_fixtures failed for league %d", league_id, exc_info=True)
    return success
