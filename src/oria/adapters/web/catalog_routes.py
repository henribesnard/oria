"""Routes catalogue : /catalog/* — données de référence depuis le cache."""

from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, HTTPException, Query

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
_squad_repo: Any = None

_DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def init_catalog_routes(
    *,
    leagues: object | None = None,
    standings: object | None = None,
    teams: object | None = None,
    players: object | None = None,
    fixtures: object | None = None,
    live: object | None = None,
    squad: object | None = None,
) -> None:
    global _leagues_repo, _standings_repo, _teams_repo, _players_repo, _fixtures_repo, _live_repo, _squad_repo  # noqa: PLW0603
    _leagues_repo = leagues
    _standings_repo = standings
    _teams_repo = teams
    _players_repo = players
    _fixtures_repo = fixtures
    _live_repo = live
    _squad_repo = squad


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
    fixture_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    round_: str | None = Query(None, alias="round"),
) -> list[dict[str, Any]]:
    """Liste les matchs (prochains, passés, par date, ou par ID)."""
    if _fixtures_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")

    # fixture_id est exclusif : ignore tous les autres paramètres
    if fixture_id:
        key = f"id={fixture_id}"
        data = await _fixtures_repo.get(key)
        if data is None:
            return []
        items = data if isinstance(data, list) else [data]
        return [_flatten_fixture(f) for f in items]

    # Validation date_from / date_to
    if date_from or date_to:
        if not (date_from and date_to):
            raise HTTPException(status_code=422, detail="date_from et date_to sont requis ensemble")
        if not (_DATE_RE.match(date_from) and _DATE_RE.match(date_to)):
            raise HTTPException(status_code=422, detail="Format de date invalide (YYYY-MM-DD attendu)")
        try:
            dt_from = datetime.strptime(date_from, "%Y-%m-%d")
            dt_to = datetime.strptime(date_to, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=422, detail="Date invalide")
        if (dt_to - dt_from) > timedelta(days=60):
            raise HTTPException(status_code=422, detail="Fenêtre de dates limitée à 60 jours")

    parts = []
    if league_id:
        parts.append(f"league={league_id}")
    if team_id:
        parts.append(f"team={team_id}")
    effective_season = season or (_current_season() if (date_from or date_to) else None)
    if effective_season:
        parts.append(f"season={effective_season}")
    if date:
        parts.append(f"date={date}")
    if date_from:
        parts.append(f"from={date_from}")
    if date_to:
        parts.append(f"to={date_to}")
    if round_:
        parts.append(f"round={round_}")
    if next_count:
        parts.append(f"next={next_count}")
    if last_count:
        parts.append(f"last={last_count}")
    if not next_count and not last_count and not date and not date_from:
        parts.append("next=10")
    # Ordre déterministe pour clé de cache stable
    parts.sort()
    key = "&".join(parts)
    data = await _fixtures_repo.get(key)
    if data is None:
        return []
    items = data if isinstance(data, list) else [data]
    flat = [_flatten_fixture(f) for f in items]
    return flat


@router.get("/squad")
async def get_squad(team_id: int) -> list[dict[str, Any]]:
    """Effectif complet d'une équipe (depuis /players/squads)."""
    if _squad_repo is None:
        raise HTTPException(status_code=503, detail="catalog not available")
    data = await _squad_repo.get(f"team={team_id}")
    if data is None:
        return []
    return data if isinstance(data, list) else [data]


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
