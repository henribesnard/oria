"""Façades outils football — exposées au LLM via le registre."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from oria.domain.fixtures import FixturesRepository
    from oria.domain.standings import StandingsRepository
    from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def register_football_tools(
    registry: ToolRegistry,
    *,
    fixtures: FixturesRepository,
    standings: StandingsRepository,
) -> None:
    """Enregistre les outils football dans le registre."""

    async def get_fixtures(league_id: int = 0, team_id: int = 0) -> Any:  # noqa: ANN401
        key = f"league={league_id}&team={team_id}"
        return await fixtures.get(key)

    async def get_standings(league_id: int = 0, season: int = 0) -> Any:  # noqa: ANN401
        key = f"league={league_id}&season={season}"
        return await standings.get(key)

    registry.register(
        "get_fixtures",
        "Récupère les matchs d'une ligue ou d'une équipe.",
        {
            "type": "object",
            "properties": {
                "league_id": {"type": "integer", "description": "ID de la ligue"},
                "team_id": {"type": "integer", "description": "ID de l'équipe"},
            },
        },
        get_fixtures,
    )

    registry.register(
        "get_standings",
        "Récupère le classement d'une ligue pour une saison.",
        {
            "type": "object",
            "properties": {
                "league_id": {"type": "integer", "description": "ID de la ligue"},
                "season": {"type": "integer", "description": "Année de la saison"},
            },
        },
        get_standings,
    )
