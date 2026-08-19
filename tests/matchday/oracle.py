"""Oracle -- collecte de la verite terrain via API-Football direct.

Interroge API-Football en direct (hors cache ORIA) pour obtenir
la verite terrain independante du systeme teste : scores, statuts,
evenements, compositions, classements.

Chaque payload brut est horodate et stocke tel quel dans oracle/.
"""

from __future__ import annotations

import json
import logging
import os
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# API-Football v3 -- acces direct, hors ORIA
_AF_BASE_URL = "https://v3.football.api-sports.io"
_AF_KEY_ENV = "APIFOOTBALL_KEY"

# ORIA admin endpoints (quota et sante)
_ORIA_BASE_URL = "http://localhost:8000"


def _af_headers() -> dict[str, str]:
    """Headers d'authentification API-Football (mode direct)."""
    key = os.environ.get(_AF_KEY_ENV, "")
    if not key:
        raise RuntimeError(f"{_AF_KEY_ENV} not set in environment")
    return {"x-apisports-key": key}


async def _af_get(
    client: httpx.AsyncClient,
    endpoint: str,
    params: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Appel GET direct a API-Football, retourne le payload brut."""
    resp = await client.get(
        f"{_AF_BASE_URL}/{endpoint}",
        params=params,
        headers=_af_headers(),
        timeout=15.0,
    )
    resp.raise_for_status()
    return resp.json()


async def collect_fixture_truth(
    client: httpx.AsyncClient,
    fixture_id: int,
) -> dict[str, Any]:
    """Collecte la verite terrain pour un match via API-Football direct."""
    ts = datetime.now(tz=UTC).isoformat()
    truth: dict[str, Any] = {
        "fixture_id": fixture_id,
        "collected_utc": ts,
        "source": "api-football-direct",
    }

    # Fixture (score, statut, minute)
    try:
        data = await _af_get(client, "fixtures", {"id": fixture_id})
        responses = data.get("response", [])
        if responses:
            fix = responses[0]
            fixture_info = fix.get("fixture", {})
            goals = fix.get("goals", {})
            score = fix.get("score", {})
            teams = fix.get("teams", {})
            truth["fixture"] = {
                "status": fixture_info.get("status", {}).get("short"),
                "elapsed": fixture_info.get("status", {}).get("elapsed"),
                "goals_home": goals.get("home"),
                "goals_away": goals.get("away"),
                "halftime": score.get("halftime"),
                "fulltime": score.get("fulltime"),
                "extratime": score.get("extratime"),
                "penalty": score.get("penalty"),
                "home": {
                    "id": teams.get("home", {}).get("id"),
                    "name": teams.get("home", {}).get("name"),
                },
                "away": {
                    "id": teams.get("away", {}).get("id"),
                    "name": teams.get("away", {}).get("name"),
                },
            }
    except Exception as exc:
        logger.warning("fixture truth failed for %d: %s", fixture_id, exc)
        truth["fixture_error"] = str(exc)

    # Events (buts, cartons, remplacements)
    try:
        data = await _af_get(client, "fixtures/events", {"fixture": fixture_id})
        truth["events"] = data.get("response", [])
    except Exception as exc:
        logger.warning("events truth failed for %d: %s", fixture_id, exc)
        truth["events_error"] = str(exc)

    # Lineups (compositions)
    try:
        data = await _af_get(client, "fixtures/lineups", {"fixture": fixture_id})
        lineups_raw = data.get("response", [])
        truth["lineups_published"] = len(lineups_raw) > 0
        if lineups_raw:
            truth["lineups"] = lineups_raw
    except Exception as exc:
        logger.warning("lineups truth failed for %d: %s", fixture_id, exc)
        truth["lineups_error"] = str(exc)

    return truth


async def collect_standings_truth(
    client: httpx.AsyncClient,
    league_id: int,
    season: int | None = None,
) -> dict[str, Any]:
    """Collecte le classement reel d'une ligue via API-Football direct."""
    ts = datetime.now(tz=UTC).isoformat()

    if season is None:
        today = datetime.now(tz=UTC)
        season = today.year if today.month >= 7 else today.year - 1

    truth: dict[str, Any] = {
        "league_id": league_id,
        "season": season,
        "collected_utc": ts,
        "source": "api-football-direct",
    }

    try:
        data = await _af_get(
            client, "standings", {"league": league_id, "season": season},
        )
        responses = data.get("response", [])
        if responses:
            league_data = responses[0].get("league", {})
            standings = league_data.get("standings", [])
            if standings:
                truth["standings"] = standings[0] if len(standings) == 1 else standings
                truth["team_count"] = (
                    len(standings[0]) if standings else 0
                )
        else:
            truth["standings"] = []
            truth["team_count"] = 0
    except Exception as exc:
        logger.warning("standings truth failed for league %d: %s", league_id, exc)
        truth["standings_error"] = str(exc)

    return truth


async def collect_oracle(
    client: httpx.AsyncClient,
    matches: list[dict[str, Any]],
    oracle_dir: Path,
) -> None:
    """Collecte toute la verite terrain et l'ecrit dans oracle/."""
    oracle_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(tz=UTC).isoformat()

    # Collecter la verite terrain pour chaque match via API-Football direct
    fixtures_truth: dict[str, Any] = {
        "collected_utc": ts,
        "source": "api-football-direct",
        "fixtures": [],
    }

    for match in matches:
        fixture_id = match["fixture_id"]
        try:
            truth = await collect_fixture_truth(client, fixture_id)
            fixtures_truth["fixtures"].append(truth)
        except Exception as exc:
            logger.warning("oracle for fixture %d failed: %s", fixture_id, exc)
            fixtures_truth["fixtures"].append({
                "fixture_id": fixture_id,
                "collected_utc": ts,
                "error": str(exc),
            })

    (oracle_dir / "fixtures.json").write_text(
        json.dumps(fixtures_truth, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Classements pour les ligues des matchs
    league_ids = {m["league_id"] for m in matches}
    standings_truth: dict[str, Any] = {
        "collected_utc": ts,
        "source": "api-football-direct",
        "leagues": [],
    }
    for lid in sorted(league_ids):
        try:
            st = await collect_standings_truth(client, lid)
            standings_truth["leagues"].append(st)
        except Exception as exc:
            logger.warning("standings oracle for league %d failed: %s", lid, exc)
            standings_truth["leagues"].append({
                "league_id": lid,
                "collected_utc": ts,
                "error": str(exc),
            })

    (oracle_dir / "standings.json").write_text(
        json.dumps(standings_truth, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Snapshot du quota API (via ORIA admin)
    try:
        resp = await client.get(
            f"{_ORIA_BASE_URL}/admin/quota",
            headers={
                "Authorization": (
                    f"Bearer {os.environ.get('ADMIN_BOOTSTRAP_TOKEN', 'changeme')}"
                ),
            },
        )
        if resp.status_code == 200:
            quota_data = resp.json()
            quota_data["collected_utc"] = ts
            (oracle_dir / "quota_snapshot.json").write_text(
                json.dumps(quota_data, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
    except Exception as exc:
        logger.warning("quota snapshot failed: %s", exc)

    # Snapshot de sante (via ORIA)
    try:
        resp = await client.get(f"{_ORIA_BASE_URL}/health")
        if resp.status_code == 200:
            health = resp.json()
            health["collected_utc"] = ts
            (oracle_dir / "health_snapshot.json").write_text(
                json.dumps(health, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
    except Exception as exc:
        logger.warning("health snapshot failed: %s", exc)

    logger.info(
        "oracle collected: %d fixtures, %d leagues (source: api-football-direct)",
        len(matches),
        len(league_ids),
    )
