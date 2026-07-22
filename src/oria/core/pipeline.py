"""Pipeline défensif — handle_message ne lève JAMAIS."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import IncomingRequest, Response
from oria.kernel.resilience import guard

if TYPE_CHECKING:
    from oria.core.orchestrator import Orchestrator
    from oria.core.prerouter import PreRouter
    from oria.core.synthesis import Synthesis

logger = logging.getLogger(__name__)


class Pipeline:
    """Module requis : orchestre les stages et renvoie toujours une Response."""

    name: str = "pipeline"
    required: bool = True
    provides: tuple[str, ...] = ("pipeline",)

    def __init__(
        self,
        *,
        synthesis: Synthesis,
        prerouter: PreRouter | None = None,
        orchestrator: Orchestrator | None = None,
    ) -> None:
        self._synthesis = synthesis
        self._prerouter = prerouter
        self._orchestrator = orchestrator

    async def start(self) -> None:
        logger.info("pipeline ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def handle_message(self, req: IncomingRequest) -> Response:
        """Point d'entrée unique — ne lève jamais."""
        try:
            return await self._process(req)
        except Exception:
            logger.exception("pipeline error — fallback")
            try:
                return await self._synthesis.fallback()
            except Exception:
                logger.exception("synthesis fallback also failed")
                return Response(
                    text="Une erreur inattendue est survenue. Réessaie plus tard.",
                    degraded=True,
                )

    async def _process(self, req: IncomingRequest) -> Response:
        """Enchaîne les stages sous guard."""
        # Stage 1 : pré-routeur (templates, sans LLM)
        if self._prerouter is not None:
            async with guard("prerouter", on_error=lambda: None):
                result = await self._prerouter.try_route(req)
                if result is not None:
                    return result

        # Stage 2 : orchestrateur (LLM + outils)
        if self._orchestrator is not None:
            async with guard("orchestrator", on_error=lambda: None):
                text = await self._orchestrator.run(req)
                if text:
                    return await self._synthesis.render(text)

        # Stage 3 : fallback — réponse minimale
        return await self._synthesis.render(
            f"Je n'ai pas pu traiter ta demande « {req.text} » pour le moment. "
            "Essaie de reformuler ou réessaie plus tard.",
            degraded=True,
        )
