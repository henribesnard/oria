"""Synthèse — rédige la réponse finale avec attachments et contexte."""

from __future__ import annotations

import logging

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import Attachment, Response, SuggestedAction

logger = logging.getLogger(__name__)


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
