"""Provider LLM DeepSeek — client OpenAI-compatible avec function calling."""

from __future__ import annotations

import logging
from typing import Any

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.resilience import resilient

logger = logging.getLogger(__name__)


class DeepSeekProvider:
    """Module optionnel : appels DeepSeek via le SDK OpenAI."""

    name: str = "llm"
    required: bool = False
    provides: tuple[str, ...] = ("llm_reasoning",)

    def __init__(self, *, api_key: str, model_fast: str, model_deep: str) -> None:
        self._api_key = api_key
        self._model_fast = model_fast
        self._model_deep = model_deep
        self._client: Any = None
        self._available = False

    async def start(self) -> None:
        if not self._api_key:
            raise RuntimeError("DEEPSEEK_API_KEY not configured")
        try:
            from openai import AsyncOpenAI

            self._client = AsyncOpenAI(
                api_key=self._api_key,
                base_url="https://api.deepseek.com/v1",
            )
        except ImportError:
            logger.warning("openai SDK not installed, LLM provider in stub mode")
        self._available = True
        logger.info("deepseek provider ready")

    async def stop(self) -> None:
        self._available = False
        if self._client is not None:
            await self._client.close()

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._available else Availability.DOWN
        return ModuleStatus(name=self.name, availability=avail)

    @resilient(
        breaker="llm", timeout=30, retries=1,
        fallback=lambda *a, **kw: {"choices": []},
    )
    async def complete(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> dict[str, Any]:
        """Appel LLM complet. Renvoie le format OpenAI standard."""
        use_model = model or self._model_fast

        if self._client is None:
            # Mode stub — retourne une réponse simulée
            return {
                "choices": [
                    {"message": {"role": "assistant", "content": "(stub LLM response)"}}
                ],
            }

        kwargs: dict[str, Any] = {
            "model": use_model,
            "messages": messages,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        response = await self._client.chat.completions.create(**kwargs)
        result: dict[str, Any] = response.model_dump()
        return result

    async def complete_stream(
        self,
        messages: list[dict[str, Any]],
        *,
        tools: list[dict[str, Any]] | None = None,
        model: str | None = None,
    ) -> Any:
        """Streaming version. Renvoie un async iterator de chunks."""
        use_model = model or self._model_fast

        if self._client is None:
            return

        kwargs: dict[str, Any] = {
            "model": use_model,
            "messages": messages,
            "stream": True,
        }
        if tools:
            kwargs["tools"] = tools
            kwargs["tool_choice"] = "auto"

        return await self._client.chat.completions.create(**kwargs)
