"""Oracle -- collecte de la verite terrain.

Recupere les donnees factuelles reelles (scores, classements, events)
au moment du run, pour appariement ulterieur par Cowork.
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

BASE_URL = "http://localhost:8000"


async def collect_fixture_truth(
    client: httpx.AsyncClient,
    fixture_id: int,
) -> dict[str, Any]:
    """Collecte la verite terrain pour un match via le catalog."""
    # On passe par le catalog ORIA (pas d'appel API-Football direct)
    truth: dict[str, Any] = {
        "fixture_id": fixture_id,
        "collected_utc": datetime.now(tz=UTC).isoformat(),
    }

    # Le catalog ne donne pas un endpoint par fixture_id,
    # donc on utilise les donnees deja presentes dans le plan.
    # Pour le dry-run, les scores sont dans le MatchTarget.
    return truth


async def collect_standings_truth(
    client: httpx.AsyncClient,
    league_id: int,
) -> dict[str, Any]:
    """Collecte le classement reel d'une ligue."""
    truth: dict[str, Any] = {
        "league_id": league_id,
        "collected_utc": datetime.now(tz=UTC).isoformat(),
    }

    # On ne fait PAS d'appel API-Football direct.
    # On utilise le catalog ORIA qui passe par le cache.
    # Pour un run reel, on pourrait appeler /catalog/fixtures?league_id=X
    # mais pour le dry-run on se contente des donnees du plan.

    return truth


async def collect_oracle(
    client: httpx.AsyncClient,
    matches: list[dict[str, Any]],
    oracle_dir: Path,
) -> None:
    """Collecte toute la verite terrain et l'ecrit dans oracle/."""
    oracle_dir.mkdir(parents=True, exist_ok=True)
    ts = datetime.now(tz=UTC).isoformat()

    # Snapshot des matchs (scores reels)
    fixtures_truth = {
        "collected_utc": ts,
        "fixtures": [],
    }
    for match in matches:
        fixtures_truth["fixtures"].append({
            "fixture_id": match["fixture_id"],
            "home_team": match["home_team"],
            "away_team": match["away_team"],
            "score_home": match.get("score_home"),
            "score_away": match.get("score_away"),
            "status": match["status"],
            "league_id": match["league_id"],
            "league_name": match["league_name"],
            "date": match["date"],
            "round": match.get("round", ""),
        })

    (oracle_dir / "fixtures.json").write_text(
        json.dumps(fixtures_truth, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    # Snapshot du quota API
    try:
        resp = await client.get(
            f"{BASE_URL}/admin/quota",
            headers={"Authorization": f"Bearer {os.environ.get('ADMIN_BOOTSTRAP_TOKEN', 'changeme')}"},
        )
        if resp.status_code == 200:
            quota_data = resp.json()
            quota_data["collected_utc"] = ts
            (oracle_dir / "quota_snapshot.json").write_text(
                json.dumps(quota_data, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
    except Exception as e:
        logger.warning("quota snapshot failed: %s", e)

    # Snapshot de sante
    try:
        resp = await client.get(f"{BASE_URL}/health")
        if resp.status_code == 200:
            health = resp.json()
            health["collected_utc"] = ts
            (oracle_dir / "health_snapshot.json").write_text(
                json.dumps(health, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
    except Exception as e:
        logger.warning("health snapshot failed: %s", e)

    logger.info("oracle collected: %d fixtures", len(matches))
