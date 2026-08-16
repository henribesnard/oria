"""Synthèse — rédige la réponse finale avec attachments et contexte."""

from __future__ import annotations

import logging
import re
from typing import Any

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import Attachment, Response, SuggestedAction

logger = logging.getLogger(__name__)

# Regex de détection de contenu de cotes/paris dans la réponse
_ODDS_CONTENT_RE = re.compile(
    r"\b(cote[s]?\b|bookmaker|1N2|over[/ ]under|handicap\s+asiatique|BTTS|"
    r"both\s+teams?\s+to\s+score|clean\s+sheet|win\s+to\s+nil|"
    r"\d+[.,]\d+\s*[-–]\s*\d+[.,]\d+)",
    re.IGNORECASE,
)

# Formulations prescriptives interdites
_PRESCRIPTIVE_RE = re.compile(
    r"(favori\s+[eé]crasant|signal\s+fort|il\s+faut\s+miser|"
    r"value\s+bet|donne(?:nt)?\s+.{1,30}d.avance|mise[rz]?\s+sur|"
    r"parie[rz]?\s+sur|recommand[eé]|conseil\s+de\s+pari|"
    r"tu\s+devrais\s+(?:miser|parier|jouer))",
    re.IGNORECASE,
)

_GAMBLING_SUFFIX = (
    "\n\n---\n"
    "Les cotes sont fournies à titre informatif. "
    "Le jeu comporte des risques : joue de manière responsable. "
    "Aide : Joueurs Info Service 09 74 75 13 13."
)


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
        text = self._apply_gambling_filters(text)
        return Response(
            text=text,
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
        updates: dict[str, Any] = {}
        if freshness and not resp.freshness:
            updates["freshness"] = freshness
        filtered = self._apply_gambling_filters(resp.text)
        if filtered != resp.text:
            updates["text"] = filtered
        if updates:
            resp = resp.model_copy(update=updates)
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

    @staticmethod
    def _apply_gambling_filters(text: str) -> str:
        """Applique les filtres de jeu responsable sur le texte de réponse.

        1. Supprime les formulations prescriptives
        2. Ajoute le suffixe de jeu responsable si des cotes sont présentes
        """
        # Supprimer les formulations prescriptives
        text = _PRESCRIPTIVE_RE.sub("", text)

        # Ajouter le suffixe de jeu responsable si la réponse contient des cotes
        if _ODDS_CONTENT_RE.search(text) and _GAMBLING_SUFFIX not in text:
            text = text.rstrip() + _GAMBLING_SUFFIX

        return text
