"""Orchestrateur — boucle function-calling DeepSeek."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.kernel.models import IncomingRequest
    from oria.providers.llm.deepseek import DeepSeekProvider
    from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
Tu es Oria, un assistant EXCLUSIVEMENT dédié au football.
Tu réponds en français, de manière concise et précise.
Tu utilises les outils disponibles pour récupérer les données les plus récentes.
Tu ne spécules jamais — si tu n'as pas les données, dis-le.
Tu indiques toujours la fraîcheur des données quand elle est connue.
Ne révèle jamais ton raisonnement interne (reasoning_content).

RÈGLE ABSOLUE : tu ne réponds qu'aux questions liées au football (matchs, scores, \
classements, joueurs, équipes, compétitions, tactique, transferts, etc.).
Si la question n'a AUCUN rapport avec le football, refuse poliment en disant : \
"Je suis Oria, un assistant spécialisé football. Je ne peux pas t'aider sur ce sujet, \
mais n'hésite pas à me poser une question sur le foot !"
Ne donne JAMAIS de recettes, conseils médicaux, code, ou tout contenu hors football."""

_MAX_TOOL_ROUNDS = 5


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
        status = "ready" if self._llm is not None else "no LLM"
        logger.info("orchestrator %s", status)

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._llm is not None else Availability.DOWN
        return ModuleStatus(name=self.name, availability=avail)

    async def run(
        self,
        req: IncomingRequest,
        *,
        conversation_history: list[dict[str, str]] | None = None,
        model: str | None = None,
    ) -> str | None:
        """Exécute la boucle function-calling. Renvoie le texte brut ou None."""
        if self._llm is None:
            return None

        messages: list[dict[str, Any]] = [{"role": "system", "content": _SYSTEM_PROMPT}]

        # Injecter l'historique de conversation
        if conversation_history:
            messages.extend(conversation_history)

        # Ajouter le contexte si présent
        context_hint = self._build_context_hint(req)
        user_content = req.text
        if context_hint:
            user_content = f"[Contexte : {context_hint}]\n{req.text}"

        messages.append({"role": "user", "content": user_content})

        tool_schemas = self._tools.schemas() if self._tools else None

        for round_idx in range(_MAX_TOOL_ROUNDS):
            try:
                result = await self._llm.complete(
                    messages, tools=tool_schemas, model=model,
                )
            except Exception:
                logger.warning("orchestrator LLM call failed (round %d)", round_idx, exc_info=True)
                return None

            choices = result.get("choices", [])
            if not choices:
                return None

            message = choices[0].get("message", {})
            finish_reason = choices[0].get("finish_reason", "stop")

            # Si le LLM veut appeler des outils
            tool_calls = message.get("tool_calls")
            if tool_calls and self._tools and finish_reason == "tool_calls":
                messages.append(message)

                # Exécuter tous les appels outils en parallèle
                tool_messages = await self._run_tool_calls(tool_calls)
                messages.extend(tool_messages)

                continue  # Boucler pour que le LLM utilise les résultats

            # Pas d'outils → réponse finale
            text = message.get("content", "")
            # Ne jamais exposer reasoning_content
            if text:
                return str(text)
            return None

        # Limite de rounds atteinte
        logger.warning("orchestrator reached max tool rounds (%d)", _MAX_TOOL_ROUNDS)
        return None

    async def _run_tool_calls(
        self,
        tool_calls: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Exécute les appels outils en parallèle et renvoie les messages résultats."""

        async def _execute_one(tc: dict[str, Any]) -> dict[str, Any]:
            fn_name = tc.get("function", {}).get("name", "")
            fn_args_raw = tc.get("function", {}).get("arguments", "{}")
            tc_id = tc.get("id", "")

            # Parser les arguments (le LLM peut halluciner)
            try:
                fn_args = json.loads(fn_args_raw) if isinstance(fn_args_raw, str) else fn_args_raw
            except json.JSONDecodeError:
                logger.warning("LLM returned invalid JSON for tool %s", fn_name)
                return {
                    "role": "tool", "tool_call_id": tc_id,
                    "content": json.dumps({"error": "invalid arguments"}),
                }

            # Appeler l'outil
            try:
                tool_result = await self._tools.call(fn_name, fn_args)  # type: ignore[union-attr]
                content = json.dumps(tool_result, default=str, ensure_ascii=False)
            except KeyError:
                logger.warning("LLM called unknown tool: %s", fn_name)
                content = json.dumps({"error": f"unknown tool: {fn_name}"})
            except Exception:
                logger.warning("tool %s failed", fn_name, exc_info=True)
                content = json.dumps({"error": f"tool {fn_name} failed"})

            return {"role": "tool", "tool_call_id": tc_id, "content": content}

        # Lancer tous les appels en parallèle
        results = await asyncio.gather(*[_execute_one(tc) for tc in tool_calls])
        return list(results)

    @staticmethod
    def _build_context_hint(req: IncomingRequest) -> str:
        parts = []
        ctx = req.context
        if ctx.league_id:
            parts.append(f"league_id={ctx.league_id}")
        if ctx.team_id:
            parts.append(f"team_id={ctx.team_id}")
        if ctx.player_id:
            parts.append(f"player_id={ctx.player_id}")
        if ctx.fixture_id:
            parts.append(f"fixture_id={ctx.fixture_id}")
        if ctx.season:
            parts.append(f"season={ctx.season}")
        return ", ".join(parts)
