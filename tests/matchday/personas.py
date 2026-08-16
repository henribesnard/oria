"""Personas de test pour la campagne Matchday.

Definit 9 comptes de test (3 free, 3 premium, 3 guest/anonymes)
et les fonctions pour les creer/promouvoir via HTTP.
"""

from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import base64

import httpx

logger = logging.getLogger(__name__)


def _extract_sub(token: str) -> str:
    """Extrait le claim 'sub' (user_id) du JWT sans verification de signature."""
    try:
        payload_b64 = token.split(".")[1]
        # Ajouter le padding base64
        padding = 4 - len(payload_b64) % 4
        if padding != 4:
            payload_b64 += "=" * padding
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get("sub", "")
    except Exception:
        return ""

BASE_URL = "http://localhost:8000"


@dataclass
class Persona:
    """Un compte de test avec son profil."""

    name: str
    tier: str  # "free" | "premium" | "guest"
    email: str = ""
    password: str = ""
    user_id: str = ""
    access_token: str = ""
    refresh_token: str = ""
    follows: list[dict[str, Any]] = field(default_factory=list)
    description: str = ""

    @property
    def is_guest(self) -> bool:
        return self.tier == "guest"

    @property
    def auth_headers(self) -> dict[str, str]:
        if self.access_token:
            return {"Authorization": f"Bearer {self.access_token}"}
        return {}


# ---------------------------------------------------------------------------
# Les 9 personas
# ---------------------------------------------------------------------------

def build_personas() -> list[Persona]:
    """Construit les 9 personas de test."""
    return [
        # 3 free
        Persona(
            name="free_actif",
            tier="free",
            email="matchday-free1@testoria.example.com",
            password="TestOria2026!free1",
            follows=[
                {"entity_type": "team", "entity_id": 85, "name": "Paris Saint Germain"},
                {"entity_type": "league", "entity_id": 61, "name": "Ligue 1"},
            ],
            description="Utilisateur free avec follows (PSG, Ligue 1)",
        ),
        Persona(
            name="free_vierge",
            tier="free",
            email="matchday-free2@testoria.example.com",
            password="TestOria2026!free2",
            follows=[],
            description="Utilisateur free sans follows",
        ),
        Persona(
            name="free_limite",
            tier="free",
            email="matchday-free3@testoria.example.com",
            password="TestOria2026!free3",
            follows=[
                {"entity_type": "team", "entity_id": 81, "name": "Marseille"},
            ],
            description="Utilisateur free qui testera les limites de quota",
        ),
        # 3 premium
        Persona(
            name="premium_actif",
            tier="premium",
            email="matchday-prem1@testoria.example.com",
            password="TestOria2026!prem1",
            follows=[
                {"entity_type": "team", "entity_id": 85, "name": "Paris Saint Germain"},
                {"entity_type": "team", "entity_id": 541, "name": "Real Madrid"},
                {"entity_type": "league", "entity_id": 61, "name": "Ligue 1"},
                {"entity_type": "league", "entity_id": 2, "name": "Champions League"},
            ],
            description="Premium actif, multi-follows",
        ),
        Persona(
            name="premium_vierge",
            tier="premium",
            email="matchday-prem2@testoria.example.com",
            password="TestOria2026!prem2",
            follows=[],
            description="Premium sans follows, teste l'acces features premium",
        ),
        Persona(
            name="premium_intensif",
            tier="premium",
            email="matchday-prem3@testoria.example.com",
            password="TestOria2026!prem3",
            follows=[
                {"entity_type": "team", "entity_id": 40, "name": "Liverpool"},
            ],
            description="Premium qui envoie beaucoup de requetes (test charge)",
        ),
        # 3 guest (anonymes via /chat/public)
        Persona(
            name="guest_curieux",
            tier="guest",
            description="Guest anonyme, questions factuelles variees",
        ),
        Persona(
            name="guest_adversarial",
            tier="guest",
            description="Guest anonyme, questions adversariales et edge cases",
        ),
        Persona(
            name="guest_live",
            tier="guest",
            description="Guest anonyme, questions sur les matchs en direct",
        ),
    ]


# ---------------------------------------------------------------------------
# Creation des comptes via HTTP
# ---------------------------------------------------------------------------

async def create_persona_account(
    client: httpx.AsyncClient,
    persona: Persona,
) -> Persona:
    """Cree le compte, login, et configure les follows."""
    if persona.is_guest:
        logger.info("persona %s is guest, no account needed", persona.name)
        return persona

    # Register
    resp = await client.post(
        f"{BASE_URL}/auth/register",
        json={"email": persona.email, "password": persona.password},
    )
    if resp.status_code in (200, 201):
        data = resp.json()
        token = data.get("access_token", "")
        persona.access_token = token
        persona.refresh_token = data.get("refresh_token", "")
        persona.user_id = data.get("user_id", "") or _extract_sub(token)
        logger.info("registered %s -> user_id=%s", persona.name, persona.user_id)
    elif resp.status_code in (400, 409) and "already" in resp.text.lower():
        logger.info("persona %s already exists, logging in", persona.name)
    else:
        logger.warning(
            "register %s failed: %d %s", persona.name, resp.status_code, resp.text[:200]
        )

    # Login (refresh token si deja enregistre, ou si register n'a pas renvoye de token)
    if not persona.access_token:
        resp = await client.post(
            f"{BASE_URL}/auth/login",
            json={"email": persona.email, "password": persona.password},
        )
        if resp.status_code == 200:
            data = resp.json()
            persona.access_token = data.get("access_token", "")
            persona.refresh_token = data.get("refresh_token", "")
            if not persona.user_id:
                persona.user_id = _extract_sub(persona.access_token)
            logger.info("logged in %s", persona.name)
        else:
            logger.error(
                "login %s failed: %d %s", persona.name, resp.status_code, resp.text[:200]
            )
            return persona

    # Follows
    for follow in persona.follows:
        resp = await client.post(
            f"{BASE_URL}/follows",
            json=follow,
            headers=persona.auth_headers,
        )
        if resp.status_code in (200, 201):
            logger.info("follow %s -> %s", persona.name, follow["name"])
        else:
            logger.warning(
                "follow %s failed: %d %s",
                persona.name, resp.status_code, resp.text[:100],
            )

    return persona


async def promote_to_premium(
    client: httpx.AsyncClient,
    persona: Persona,
    admin_token: str,
) -> None:
    """Promeut un persona en premium via l'admin API."""
    if not persona.user_id:
        logger.error("cannot promote %s: no user_id", persona.name)
        return

    # PATCH /admin/users/{user_id} n'est pas dispo avec Bearer admin_token
    # Il faut passer par la DB ou le billing. Pour le dry-run, on note l'ecart.
    logger.warning(
        "promote_to_premium(%s): not implemented yet — "
        "requires admin JWT or direct DB write",
        persona.name,
    )


async def setup_all_personas(
    client: httpx.AsyncClient,
    admin_token: str = "",
) -> list[Persona]:
    """Cree et configure tous les comptes de test."""
    personas = build_personas()

    for p in personas:
        await create_persona_account(client, p)

    # Promouvoir les premium
    for p in personas:
        if p.tier == "premium" and p.user_id:
            await promote_to_premium(client, p, admin_token)

    return personas


def export_personas(personas: list[Persona], path: Path) -> None:
    """Exporte les personas dans un JSON (sans tokens ni mots de passe)."""
    safe = []
    for p in personas:
        d = asdict(p)
        d.pop("password", None)
        d.pop("access_token", None)
        d.pop("refresh_token", None)
        safe.append(d)

    path.write_text(
        json.dumps(safe, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
