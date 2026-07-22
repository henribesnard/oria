"""Provider LLM DeepSeek (stub M3)."""

from __future__ import annotations

import logging
from typing import Any

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class DeepSeekProvider:
    """Module optionnel : appels DeepSeek (function calling)."""

    name: str = "llm"
    required: bool = False
    provides: tuple[str, ...] = ("llm_reasoning",)

    def __init__(self, *, api_key: str, model_fast: str, model_deep: str) -> None:
        self._api_key = api_key
        self._model_fast = model_fast
        self._model_deep = model_deep
        self._available = False

    async def start(self) -> None:
        if not self._api_key:
            raise RuntimeError("DEEPSEEK_API_KEY not configured")
        self._available = True
        logger.info("deepseek provider ready (stub)")

    async def stop(self) -> None:
        self._available = False

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._available else Availability.DOWN
        return ModuleStatus(name=self.name, availability=avail)

    async def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        """Stub — sera implémenté avec le SDK openai."""
        _ = messages, tools
        return {"choices": [{"message": {"content": "(stub LLM response)"}}]}
