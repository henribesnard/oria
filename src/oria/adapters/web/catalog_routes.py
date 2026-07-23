"""Routes catalogue : /catalog/* — données de référence depuis le cache."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/catalog", tags=["catalog"])

_standings_repo: Any = None
_teams_repo: Any = None
_players_repo: Any = None
_fixtures_repo: Any = None


def init_catalog_routes(
    *,
    standings: object | None = None,
    teams: object | None = None,
    players: object | None = None,
    fixtures: object | None = None,
) -> None:
    global _standings_repo, _teams_repo, _players_repo, _fixtures_repo  # noqa: PLW0603
    _standings_repo = standings
    _teams_repo = teams
    _players_repo = players
    _fixtures_repo = fixtures


@router.get("/leagues")
async def list_leagues(
    country: str | None = None,
) -> list[dict[str, Any]]:
    """Liste les ligues disponibles (depuis le cache standings)."""
    if _standings_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    key = f"country={country}" if country else "all"
    data = await _standings_repo.get(key)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]


@router.get("/teams")
async def list_teams(
    league_id: int | None = None,
    season: int | None = None,
) -> list[dict[str, Any]]:
    """Liste les équipes d'une ligue."""
    if _teams_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    parts = []
    if league_id:
        parts.append(f"league={league_id}")
    if season:
        parts.append(f"season={season}")
    key = "&".join(parts) if parts else "all"
    data = await _teams_repo.get(key)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]


@router.get("/players")
async def list_players(
    team_id: int | None = None,
    season: int | None = None,
) -> list[dict[str, Any]]:
    """Liste les joueurs d'une équipe."""
    if _players_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    parts = []
    if team_id:
        parts.append(f"team={team_id}")
    if season:
        parts.append(f"season={season}")
    key = "&".join(parts) if parts else "all"
    data = await _players_repo.get(key)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]


@router.get("/fixtures")
async def list_fixtures(
    league_id: int | None = None,
    team_id: int | None = None,
    next_count: int = 10,
) -> list[dict[str, Any]]:
    """Liste les prochains matchs."""
    if _fixtures_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    parts = []
    if league_id:
        parts.append(f"league={league_id}")
    if team_id:
        parts.append(f"team={team_id}")
    parts.append(f"next={next_count}")
    key = "&".join(parts)
    data = await _fixtures_repo.get(key)
    if data is None:
        return []
    if isinstance(data, list):
        return data
    return [data]
