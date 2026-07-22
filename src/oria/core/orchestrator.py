"""Orchestrateur — boucle function-calling DeepSeek (stub M6)."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.kernel.models import IncomingRequest
    from oria.providers.llm.deepseek import DeepSeekProvider
    from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class Orchestrator:
    """Module optionnel : boucle function-calling avec le LLM."""

    name: str = "orchestrator"
    required: bool = False
    provides: tuple[str, ...] = ("orchestration",)

    def __init__(
        self,
        *,
        llm: DeepSeekProvider | None = None,
        tools: ToolRegistry | None = None,
    ) -> None:
        self._llm = llm
        self._tools = tools

    async def start(self) -> None:
        logger.info("orchestrator ready (stub)")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._llm is not None else Availability.DOWN
        return ModuleStatus(name=self.name, availability=avail)

    async def run(self, req: IncomingRequest) -> str | None:
        """Exécute la boucle function-calling. Renvoie le texte brut ou None."""
        if self._llm is None:
            return None

        # Stub M6 : appel simple sans boucle d'outils réelle
        try:
            result = await self._llm.complete(
                [{"role": "user", "content": req.text}],
                tools=self._tools.schemas() if self._tools else None,
            )
            choices = result.get("choices", [])
            if choices:
                return choices[0].get("message", {}).get("content", "")  # type: ignore[no-any-return]
        except Exception:
            logger.warning("orchestrator LLM call failed", exc_info=True)

        return None
