"""Synthèse — rédige la réponse finale (stub M0 : template minimal)."""

from __future__ import annotations

import logging

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import Response

logger = logging.getLogger(__name__)


class Synthesis:
    """Module requis : garantit toujours une Response valide."""

    name: str = "synthesis"
    required: bool = True
    provides: tuple[str, ...] = ("synthesis",)

    async def start(self) -> None:
        logger.info("synthesis ready (template mode)")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def render(self, text: str, *, degraded: bool = False) -> Response:
        """Produit une Response à partir du texte brut."""
        return Response(text=text, degraded=degraded)

    async def fallback(self, reason: str = "indisponibilité temporaire") -> Response:
        """Réponse dégradée de dernier recours."""
        return Response(
            text=f"Désolé, je ne peux pas répondre pour le moment ({reason}). "
            "Réessaie dans quelques instants.",
            degraded=True,
        )
