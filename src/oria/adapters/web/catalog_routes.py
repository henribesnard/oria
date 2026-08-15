"""Routes catalogue : /catalog/* — données de référence depuis le cache."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException

router = APIRouter(prefix="/catalog", tags=["catalog"])


def _current_season() -> int:
    """Saison courante : année en cours si >= août, sinon année précédente."""
    now = datetime.now()
    return now.year if now.month >= 7 else now.year - 1


# ── Ligues majeures (pour suggestion frontend) ──────────────────────────
# Note: Le backend retourne toutes les ligues, le frontend filtre selon l'utilisateur
MAJOR_LEAGUE_IDS: set[int] = {
    # UEFA
    2,    # Champions League
    3,    # Europa League
    848,  # Conference League
    # Top 5 championnats (+ divisions 2)
    61,   # Ligue 1
    39,   # Premier League
    140,  # La Liga
    78,   # Bundesliga
    79,   # 2. Bundesliga
    135,  # Serie A
    # Championnats secondaires
    94,   # Primeira Liga (Portugal)
    88,   # Eredivisie (Pays-Bas)
    144,  # Jupiler Pro League (Belgique)
}

_leagues_repo: Any = None
_standings_repo: Any = None
_teams_repo: Any = None
_players_repo: Any = None
_fixtures_repo: Any = None
_live_repo: Any = None


def init_catalog_routes(
    *,
    leagues: object | None = None,
    standings: object | None = None,
    teams: object | None = None,
    players: object | None = None,
    fixtures: object | None = None,
    live: object | None = None,
) -> None:
    global _leagues_repo, _standings_repo, _teams_repo, _players_repo, _fixtures_repo, _live_repo  # noqa: PLW0603
    _leagues_repo = leagues
    _standings_repo = standings
    _teams_repo = teams
    _players_repo = players
    _fixtures_repo = fixtures
    _live_repo = live


@router.get("/leagues")
async def list_leagues(
    country: str | None = None,
    season: int | None = None,
) -> list[dict[str, Any]]:
    """Liste les ligues disponibles avec logos et pays."""
    if _leagues_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    parts = []
    if country:
        parts.append(f"country={country}")
    if season:
        parts.append(f"season={season}")
    key = "&".join(parts) if parts else "current=true"
    data = await _leagues_repo.get(key)
    if data is None:
        return []
    items = data if isinstance(data, list) else [data]
    # Retourne toutes les ligues (le frontend gère le filtrage)
    return items


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
    # API Football exige un season quand on filtre par ligue
    effective_season = season or _current_season()
    if league_id or season:
        parts.append(f"season={effective_season}")
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


@router.get("/fixtures/live")
async def list_live_fixtures() -> list[dict[str, Any]]:
    """Liste les matchs en direct (live=all)."""
    if _live_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    data = await _live_repo.get("", allow_stale=False)
    if data is None:
        return []
    items = data if isinstance(data, list) else [data]
    flat = [_flatten_fixture(f) for f in items]
    # Retourne tous les matchs live (le frontend gère le filtrage)
    return flat


@router.get("/fixtures")
async def list_fixtures(
    league_id: int | None = None,
    team_id: int | None = None,
    season: int | None = None,
    next_count: int | None = None,
    last_count: int | None = None,
    date: str | None = None,
) -> list[dict[str, Any]]:
    """Liste les matchs (prochains, passés ou par date)."""
    if _fixtures_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    parts = []
    if league_id:
        parts.append(f"league={league_id}")
    if team_id:
        parts.append(f"team={team_id}")
    if season:
        parts.append(f"season={season}")
    if date:
        parts.append(f"date={date}")
    if next_count:
        parts.append(f"next={next_count}")
    if last_count:
        parts.append(f"last={last_count}")
    if not next_count and not last_count and not date:
        parts.append("next=10")
    key = "&".join(parts)
    data = await _fixtures_repo.get(key)
    if data is None:
        return []
    items = data if isinstance(data, list) else [data]
    flat = [_flatten_fixture(f) for f in items]
    # Retourne tous les matchs (le frontend gère le filtrage)
    return flat


def _flatten_fixture(fx: dict[str, Any]) -> dict[str, Any]:
    """Aplatit un fixture du mapper vers le format frontend."""
    home = fx.get("home", {})
    away = fx.get("away", {})
    league = fx.get("league", {})
    status = fx.get("status", {})
    return {
        "id": fx.get("id"),
        "date": fx.get("date"),
        "timestamp": fx.get("timestamp"),
        "home_team": home.get("name", ""),
        "home_id": home.get("id"),
        "home_logo": home.get("logo"),
        "away_team": away.get("name", ""),
        "away_id": away.get("id"),
        "away_logo": away.get("logo"),
        "score_home": fx.get("goals_home"),
        "score_away": fx.get("goals_away"),
        "status": status.get("short", ""),
        "status_long": status.get("long", ""),
        "elapsed": status.get("elapsed"),
        "league_id": league.get("id"),
        "league_name": league.get("name", ""),
        "league_logo": league.get("logo"),
        "league_country": league.get("country"),
        "league_flag": league.get("flag"),
        "round": league.get("round"),
        "venue": fx.get("venue", {}),
        "referee": fx.get("referee"),
    }
