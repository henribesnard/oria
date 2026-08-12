"""Façades outils football — exposées au LLM via le registre."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from oria.domain.fixtures import FixturesRepository
    from oria.domain.head2head import HeadToHeadRepository
    from oria.domain.injuries import InjuriesRepository
    from oria.domain.lineups import LineupsRepository
    from oria.domain.live import LiveRepository
    from oria.domain.match_events import EventsRepository
    from oria.domain.match_statistics import StatisticsRepository
    from oria.domain.odds import OddsRepository
    from oria.domain.players import PlayersRepository
    from oria.domain.standings import StandingsRepository
    from oria.domain.team_statistics import TeamStatisticsRepository
    from oria.domain.teams import TeamsRepository
    from oria.domain.top_players import TopAssistsRepository, TopScorersRepository
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
    events: EventsRepository,
    statistics: StatisticsRepository,
    head2head: HeadToHeadRepository,
    team_statistics: TeamStatisticsRepository,
    top_scorers: TopScorersRepository,
    top_assists: TopAssistsRepository,
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

    # ---- get_match_events ----
    async def get_match_events(fixture_id: int = 0) -> Any:  # noqa: ANN401
        return await events.get(f"fixture={fixture_id}")

    registry.register(
        "get_match_events",
        "Récupère les événements d'un match (buts, cartons, remplacements). "
        "Fonctionne pour les matchs en cours et terminés.",
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
        get_match_events,
    )

    # ---- get_match_statistics ----
    async def get_match_statistics(fixture_id: int = 0) -> Any:  # noqa: ANN401
        return await statistics.get(f"fixture={fixture_id}")

    registry.register(
        "get_match_statistics",
        "Récupère les statistiques d'un match (possession, tirs, passes, etc.). "
        "Fonctionne pour les matchs en cours et terminés.",
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
        get_match_statistics,
    )

    # ---- get_h2h ----
    async def get_h2h(
        team_id_1: int = 0,
        team_id_2: int = 0,
        last: int = 10,
    ) -> Any:  # noqa: ANN401
        return await head2head.get(
            f"h2h={team_id_1}-{team_id_2}&last={last}",
        )

    registry.register(
        "get_h2h",
        "Récupère les confrontations directes entre deux équipes.",
        {
            "type": "object",
            "properties": {
                "team_id_1": {
                    "type": "integer",
                    "description": "ID de la première équipe",
                },
                "team_id_2": {
                    "type": "integer",
                    "description": "ID de la deuxième équipe",
                },
                "last": {
                    "type": "integer",
                    "description": "Nombre de dernières confrontations (défaut 10)",
                },
            },
            "required": ["team_id_1", "team_id_2"],
        },
        get_h2h,
    )

    # ---- get_team_stats ----
    async def get_team_stats(
        team_id: int = 0,
        league_id: int = 0,
        season: int = 0,
    ) -> Any:  # noqa: ANN401
        return await team_statistics.get(
            f"team={team_id}&league={league_id}&season={season}",
        )

    registry.register(
        "get_team_stats",
        "Récupère les statistiques saisonnières d'une équipe "
        "(buts marqués/encaissés, série, forme, etc.).",
        {
            "type": "object",
            "properties": {
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
                    "description": "Année de la saison",
                },
            },
            "required": ["team_id", "league_id", "season"],
        },
        get_team_stats,
    )

    # ---- get_top_scorers ----
    async def get_top_scorers(
        league_id: int = 0,
        season: int = 0,
    ) -> Any:  # noqa: ANN401
        return await top_scorers.get(
            f"league={league_id}&season={season}",
        )

    registry.register(
        "get_top_scorers",
        "Récupère les meilleurs buteurs d'une ligue pour une saison.",
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
        get_top_scorers,
    )

    # ---- get_top_assists ----
    async def get_top_assists(
        league_id: int = 0,
        season: int = 0,
    ) -> Any:  # noqa: ANN401
        return await top_assists.get(
            f"league={league_id}&season={season}",
        )

    registry.register(
        "get_top_assists",
        "Récupère les meilleurs passeurs d'une ligue pour une saison.",
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
        get_top_assists,
    )
