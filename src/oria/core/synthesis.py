"""Synthèse — rédige la réponse finale avec attachments et contexte."""

from __future__ import annotations

import logging
import re
from typing import Any

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import Attachment, Response, SuggestedAction

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Post-filter : supprime les identifiants internes fuyant du LLM
# ---------------------------------------------------------------------------

_INTERNAL_ID_PATTERNS: list[re.Pattern[str]] = [
    # fixture identifiers: fixture_id 12345, fixture_id=12345, fixture 12345
    re.compile(r"\bfixture_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bfixture_id\s+\d+", re.IGNORECASE),
    re.compile(r"\bfixture\s*=\s*\d+", re.IGNORECASE),
    re.compile(r"\bfixture\s+\d{3,}", re.IGNORECASE),
    # team identifiers: team_id 85, team_id=85
    re.compile(r"\bteam_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bteam_id\s+\d+", re.IGNORECASE),
    re.compile(r"\bteam\s*=\s*\d+", re.IGNORECASE),
    re.compile(r"\bteam\s+\d{3,}", re.IGNORECASE),
    # league identifiers: league_id 61, league_id=61
    re.compile(r"\bleague_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bleague_id\s+\d+", re.IGNORECASE),
    re.compile(r"\bleague\s*=\s*\d+", re.IGNORECASE),
    # player identifiers: player_id 276, player_id=276
    re.compile(r"\bplayer_id\s*[=:]\s*\d+", re.IGNORECASE),
    re.compile(r"\bplayer_id\s+\d+", re.IGNORECASE),
    # generic internal ID (3+ digits to avoid stripping "ID 1" or "ID 42")
    re.compile(r"\bID\s+\d{3,}\b"),
    # API endpoint paths
    re.compile(r"/fixtures\b"),
    re.compile(r"/standings\b"),
    re.compile(r"/odds\b"),
    re.compile(r"/teams\b"),
    # tool function names: get_standings, get_fixtures, etc.
    re.compile(r"\bget_\w+", re.IGNORECASE),
]

_MULTI_SPACE = re.compile(r"  +")


def _strip_internal_ids(text: str) -> str:
    """Supprime les identifiants internes que le LLM ne doit jamais exposer."""
    cleaned = text
    for pattern in _INTERNAL_ID_PATTERNS:
        cleaned = pattern.sub("", cleaned)
    # Collapse runs of whitespace and strip
    cleaned = _MULTI_SPACE.sub(" ", cleaned).strip()
    # Remove orphaned parentheses/brackets left empty after stripping
    cleaned = re.sub(r"\(\s*\)", "", cleaned)
    cleaned = re.sub(r"\[\s*\]", "", cleaned)
    cleaned = _MULTI_SPACE.sub(" ", cleaned).strip()
    return cleaned


class Synthesis:
    """Module requis : garantit toujours une Response valide."""

    name: str = "synthesis"
    required: bool = True
    provides: tuple[str, ...] = ("synthesis",)

    async def start(self) -> None:
        logger.info("synthesis ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def render(
        self,
        text: str,
        *,
        degraded: bool = False,
        attachments: list[Attachment] | None = None,
        suggested_actions: list[SuggestedAction] | None = None,
        freshness: str | None = None,
    ) -> Response:
        """Produit une Response riche à partir des éléments du pipeline."""
        return Response(
            text=_strip_internal_ids(text),
            degraded=degraded,
            attachments=attachments or [],
            suggested_actions=suggested_actions or [],
            freshness=freshness,
        )

    async def render_from_response(
        self,
        resp: Response,
        *,
        freshness: str | None = None,
    ) -> Response:
        """Enrichit une Response existante (ex: prerouter) avec freshness."""
        if freshness and not resp.freshness:
            resp = resp.model_copy(update={"freshness": freshness})
        return resp

    async def quota_exceeded(self, reason: str) -> Response:
        """Réponse lorsque le quota est dépassé."""
        return Response(
            text=reason,
            degraded=True,
            suggested_actions=[
                SuggestedAction(
                    label="Passer Premium",
                    payload={"action": "upgrade"},
                ),
            ],
        )

    async def fallback(self, reason: str = "indisponibilité temporaire") -> Response:
        """Réponse dégradée de dernier recours."""
        return Response(
            text=f"Désolé, je ne peux pas répondre pour le moment ({reason}). "
            "Réessaie dans quelques instants.",
            degraded=True,
        )
