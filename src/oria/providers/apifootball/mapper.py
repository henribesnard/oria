"""Mapper JSON brut API-Football → modèles domaine.

Chaque fonction extrait le champ `response` et normalise
les données en un format exploitable par les repositories.
"""

from __future__ import annotations

from typing import Any


def map_fixtures(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /fixtures → liste de matchs normalisés."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        fixture = item.get("fixture", {})
        league = item.get("league", {})
        teams = item.get("teams", {})
        goals = item.get("goals", {})
        score = item.get("score", {})
        out.append({
            "id": fixture.get("id"),
            "referee": fixture.get("referee"),
            "date": fixture.get("date"),
            "timestamp": fixture.get("timestamp"),
            "status": fixture.get("status", {}),
            "venue": fixture.get("venue", {}),
            "league": {
                "id": league.get("id"),
                "name": league.get("name"),
                "country": league.get("country"),
                "season": league.get("season"),
                "round": league.get("round"),
            },
            "home": {
                "id": teams.get("home", {}).get("id"),
                "name": teams.get("home", {}).get("name"),
                "logo": teams.get("home", {}).get("logo"),
                "winner": teams.get("home", {}).get("winner"),
            },
            "away": {
                "id": teams.get("away", {}).get("id"),
                "name": teams.get("away", {}).get("name"),
                "logo": teams.get("away", {}).get("logo"),
                "winner": teams.get("away", {}).get("winner"),
            },
            "goals_home": goals.get("home"),
            "goals_away": goals.get("away"),
            "score": score,
        })
    return out


def map_standings(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /standings → liste de classements aplatis."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        league = item.get("league", {})
        standings_groups: list[list[dict[str, Any]]] = league.get(
            "standings", [],
        )
        for group in standings_groups:
            for entry in group:
                out.append({
                    "league_id": league.get("id"),
                    "league_name": league.get("name"),
                    "season": league.get("season"),
                    "rank": entry.get("rank"),
                    "team": entry.get("team", {}),
                    "points": entry.get("points"),
                    "goals_diff": entry.get("goalsDiff"),
                    "form": entry.get("form"),
                    "description": entry.get("description"),
                    "all": entry.get("all", {}),
                    "home": entry.get("home", {}),
                    "away": entry.get("away", {}),
                })
    return out


def map_events(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /fixtures/events → liste d'événements."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        out.append({
            "time": item.get("time", {}),
            "team": item.get("team", {}),
            "player": item.get("player", {}),
            "assist": item.get("assist", {}),
            "type": item.get("type"),
            "detail": item.get("detail"),
            "comments": item.get("comments"),
        })
    return out


def map_lineups(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /fixtures/lineups → compositions d'équipe."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        out.append({
            "team": item.get("team", {}),
            "formation": item.get("formation"),
            "coach": item.get("coach", {}),
            "startXI": item.get("startXI", []),
            "substitutes": item.get("substitutes", []),
        })
    return out


def map_statistics(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /fixtures/statistics → stats par équipe."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        team = item.get("team", {})
        stats_list: list[dict[str, Any]] = item.get("statistics", [])
        stats = {s["type"]: s.get("value") for s in stats_list if "type" in s}
        out.append({
            "team": {"id": team.get("id"), "name": team.get("name")},
            "statistics": stats,
        })
    return out


def map_teams(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /teams → infos équipes."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        team = item.get("team", {})
        venue = item.get("venue", {})
        out.append({
            "id": team.get("id"),
            "name": team.get("name"),
            "code": team.get("code"),
            "country": team.get("country"),
            "founded": team.get("founded"),
            "logo": team.get("logo"),
            "venue": {
                "id": venue.get("id"),
                "name": venue.get("name"),
                "city": venue.get("city"),
                "capacity": venue.get("capacity"),
            },
        })
    return out


def map_team_statistics(raw: dict[str, Any]) -> dict[str, Any]:
    """Convertit /teams/statistics → stats saisonnières d'une équipe."""
    resp: dict[str, Any] = raw.get("response", {})
    if not resp:
        return {}
    return {
        "league": resp.get("league", {}),
        "team": resp.get("team", {}),
        "form": resp.get("form"),
        "fixtures": resp.get("fixtures", {}),
        "goals": resp.get("goals", {}),
        "biggest": resp.get("biggest", {}),
        "clean_sheet": resp.get("clean_sheet", {}),
        "failed_to_score": resp.get("failed_to_score", {}),
        "penalty": resp.get("penalty", {}),
        "lineups": resp.get("lineups", []),
    }


def map_players(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /players → stats joueurs."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        player = item.get("player", {})
        stats: list[dict[str, Any]] = item.get("statistics", [])
        out.append({
            "id": player.get("id"),
            "name": player.get("name"),
            "firstname": player.get("firstname"),
            "lastname": player.get("lastname"),
            "age": player.get("age"),
            "nationality": player.get("nationality"),
            "photo": player.get("photo"),
            "statistics": stats,
        })
    return out


def map_top_scorers(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /players/topscorers → classement buteurs."""
    return map_players(raw)


def map_top_assists(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /players/topassists → classement passeurs."""
    return map_players(raw)


def map_injuries(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /injuries → blessures/suspensions."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        out.append({
            "player": item.get("player", {}),
            "team": item.get("team", {}),
            "fixture": item.get("fixture", {}),
            "league": item.get("league", {}),
        })
    return out


def map_odds(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /odds → cotes pré-match."""
    items: list[dict[str, Any]] = raw.get("response", [])
    out: list[dict[str, Any]] = []
    for item in items:
        out.append({
            "league": item.get("league", {}),
            "fixture": item.get("fixture", {}),
            "bookmakers": item.get("bookmakers", []),
        })
    return out


def map_head2head(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit /fixtures/headtohead — réutilise le format fixtures."""
    return map_fixtures(raw)
