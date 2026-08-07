"""Façades outils football — exposées au LLM via le registre."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from oria.domain.fixtures import FixturesRepository
    from oria.domain.injuries import InjuriesRepository
    from oria.domain.lineups import LineupsRepository
    from oria.domain.live import LiveRepository
    from oria.domain.odds import OddsRepository
    from oria.domain.players import PlayersRepository
    from oria.domain.standings import StandingsRepository
    from oria.domain.teams import TeamsRepository
    from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def register_football_tools(  # noqa: PLR0913
    registry: ToolRegistry,
    *,
    fixtures: FixturesRepository,
    standings: StandingsRepository,
    teams: TeamsRepository,
    players: PlayersRepository,
    injuries: InjuriesRepository,
    lineups: LineupsRepository,
    odds: OddsRepository,
    live: LiveRepository,
) -> None:
    """Enregistre les outils football dans le registre."""

    # ---- get_fixtures ----
    async def get_fixtures(
        league_id: int = 0,
        team_id: int = 0,
        season: int = 0,
        date: str = "",
        next: int = 0,
        last: int = 0,
    ) -> Any:  # noqa: ANN401
        parts = []
        if league_id:
            parts.append(f"league={league_id}")
        if team_id:
            parts.append(f"team={team_id}")
        if season:
            parts.append(f"season={season}")
        if date:
            parts.append(f"date={date}")
        if next:
            parts.append(f"next={next}")
        if last:
            parts.append(f"last={last}")
        return await fixtures.get("&".join(parts))

    registry.register(
        "get_fixtures",
        "Récupère les matchs d'une ligue ou équipe.",
        {
            "type": "object",
            "properties": {
                "league_id": {
                    "type": "integer",
                    "description": "ID de la ligue",
                },
                "team_id": {
                    "type": "integer",
                    "description": "ID de l'équipe",
                },
                "season": {
                    "type": "integer",
                    "description": "Année de la saison (ex: 2024)",
                },
                "date": {
                    "type": "string",
                    "description": "Date YYYY-MM-DD",
                },
                "next": {
                    "type": "integer",
                    "description": "Nombre de prochains matchs à retourner",
                },
                "last": {
                    "type": "integer",
                    "description": "Nombre de derniers matchs à retourner",
                },
            },
        },
        get_fixtures,
    )

    # ---- get_standings ----
    async def get_standings(
        league_id: int = 0,
        season: int = 0,
    ) -> Any:  # noqa: ANN401
        return await standings.get(
            f"league={league_id}&season={season}",
        )

    registry.register(
        "get_standings",
        "Récupère le classement d'une ligue pour une saison.",
        {
            "type": "object",
            "properties": {
                "league_id": {
                    "type": "integer",
                    "description": "ID de la ligue",
                },
                "season": {
                    "type": "integer",
                    "description": "Année de la saison",
                },
            },
            "required": ["league_id", "season"],
        },
        get_standings,
    )

    # ---- get_team_info ----
    async def get_team_info(
        team_id: int = 0,
        search: str = "",
    ) -> Any:  # noqa: ANN401
        parts = []
        if team_id:
            parts.append(f"id={team_id}")
        if search:
            parts.append(f"search={search}")
        return await teams.get("&".join(parts))

    registry.register(
        "get_team_info",
        "Récupère les informations sur une équipe.",
        {
            "type": "object",
            "properties": {
                "team_id": {
                    "type": "integer",
                    "description": "ID de l'équipe",
                },
                "search": {
                    "type": "string",
                    "description": "Nom à rechercher (min 3 car.)",
                },
            },
        },
        get_team_info,
    )

    # ---- get_player_stats ----
    async def get_player_stats(
        player_id: int = 0,
        team_id: int = 0,
        league_id: int = 0,
        season: int = 0,
    ) -> Any:  # noqa: ANN401
        parts = []
        if player_id:
            parts.append(f"id={player_id}")
        if team_id:
            parts.append(f"team={team_id}")
        if league_id:
            parts.append(f"league={league_id}")
        if season:
            parts.append(f"season={season}")
        return await players.get("&".join(parts))

    registry.register(
        "get_player_stats",
        "Récupère les statistiques d'un joueur.",
        {
            "type": "object",
            "properties": {
                "player_id": {
                    "type": "integer",
                    "description": "ID du joueur",
                },
                "team_id": {
                    "type": "integer",
                    "description": "ID de l'équipe",
                },
                "league_id": {
                    "type": "integer",
                    "description": "ID de la ligue",
                },
                "season": {
                    "type": "integer",
                    "description": "Année",
                },
            },
        },
        get_player_stats,
    )

    # ---- get_injuries ----
    async def get_injuries(
        league_id: int = 0,
        season: int = 0,
        team_id: int = 0,
        fixture_id: int = 0,
    ) -> Any:  # noqa: ANN401
        parts = []
        if fixture_id:
            parts.append(f"fixture={fixture_id}")
        if league_id:
            parts.append(f"league={league_id}")
        if season:
            parts.append(f"season={season}")
        if team_id:
            parts.append(f"team={team_id}")
        return await injuries.get("&".join(parts))

    registry.register(
        "get_injuries",
        "Récupère les blessures et suspensions.",
        {
            "type": "object",
            "properties": {
                "league_id": {
                    "type": "integer",
                    "description": "ID de la ligue",
                },
                "season": {
                    "type": "integer",
                    "description": "Année",
                },
                "team_id": {
                    "type": "integer",
                    "description": "ID de l'équipe",
                },
                "fixture_id": {
                    "type": "integer",
                    "description": "ID du match",
                },
            },
        },
        get_injuries,
    )

    # ---- get_lineups ----
    async def get_lineups(fixture_id: int = 0) -> Any:  # noqa: ANN401
        return await lineups.get(f"fixture={fixture_id}")

    registry.register(
        "get_lineups",
        "Récupère les compositions d'un match.",
        {
            "type": "object",
            "properties": {
                "fixture_id": {
                    "type": "integer",
                    "description": "ID du match",
                },
            },
            "required": ["fixture_id"],
        },
        get_lineups,
    )

    # ---- get_odds ----
    async def get_odds(
        fixture_id: int = 0,
        league_id: int = 0,
        season: int = 0,
    ) -> Any:  # noqa: ANN401
        parts = []
        if fixture_id:
            parts.append(f"fixture={fixture_id}")
        if league_id:
            parts.append(f"league={league_id}")
        if season:
            parts.append(f"season={season}")
        return await odds.get("&".join(parts))

    registry.register(
        "get_odds",
        "Récupère les cotes pré-match.",
        {
            "type": "object",
            "properties": {
                "fixture_id": {
                    "type": "integer",
                    "description": "ID du match",
                },
                "league_id": {
                    "type": "integer",
                    "description": "ID de la ligue",
                },
                "season": {
                    "type": "integer",
                    "description": "Année",
                },
            },
        },
        get_odds,
    )

    # ---- get_live_scores ----
    async def get_live_scores(
        league_id: int = 0,
    ) -> Any:  # noqa: ANN401
        key = str(league_id) if league_id else ""
        return await live.get(key)

    registry.register(
        "get_live_scores",
        "Récupère les scores en direct.",
        {
            "type": "object",
            "properties": {
                "league_id": {
                    "type": "integer",
                    "description": "ID de la ligue (vide = tous)",
                },
            },
        },
        get_live_scores,
    )
