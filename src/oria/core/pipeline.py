"""Pipeline défensif — handle_message ne lève JAMAIS."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.app.entitlements.models import DecisionKind
from oria.core.safety import (
    GAMBLING_HELP_RESPONSE,
    INJECTION_RESPONSE,
    detect_gambling_distress,
    detect_injection,
)
from oria.core.prerouter import _GREETING_RE, _ACK_RE, _HELP_RE
from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import IncomingRequest, Response
from oria.kernel.resilience import guard

if TYPE_CHECKING:
    from oria.app.conversations.service import ConversationService
    from oria.app.entitlements.service import Entitlements
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
        entitlements: Entitlements | None = None,
        conversations: ConversationService | None = None,
    ) -> None:
        self._synthesis = synthesis
        self._prerouter = prerouter
        self._orchestrator = orchestrator
        self._entitlements = entitlements
        self._conversations = conversations

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
        # Stage 0 : filtres de sécurité (AVANT quota — ne doivent jamais être bloqués)
        if detect_injection(req.text):
            return Response(text=INJECTION_RESPONSE)
        if detect_gambling_distress(req.text):
            return Response(text=GAMBLING_HELP_RESPONSE)

        # Stage 0b : entitlements (quotas) — bypass pour routes triviales
        if self._entitlements is not None and not self._is_quota_exempt(req.text):
            async with guard("entitlements", on_error=lambda: None):
                decision = await self._entitlements.check(req.user_id, "chat_message")
                if decision.kind != DecisionKind.ALLOW:
                    return await self._synthesis.quota_exceeded(decision.reason)

        # Enrichir la requête avec le contexte persistant
        if self._conversations is not None:
            async with guard("context_merge", on_error=lambda: None):
                req = await self._merge_context(req)

        # Récupérer l'historique de conversation
        conversation_history: list[dict[str, str]] | None = None
        if self._conversations is not None:
            async with guard("conversation_history", on_error=lambda: None):
                conversation_history = await self._get_conversation_history(req.user_id)

        # Stage 1 : pré-routeur (templates, sans LLM)
        if self._prerouter is not None:
            async with guard("prerouter", on_error=lambda: None):
                result = await self._prerouter.try_route(req)
                if result is not None:
                    await self._persist_turn(req, result)
                    return result

        # Stage 2 : orchestrateur (LLM + outils)
        if self._orchestrator is not None:
            async with guard("orchestrator", on_error=lambda: None):
                text = await self._orchestrator.run(
                    req,
                    conversation_history=conversation_history,
                )
                if text:
                    resp = await self._synthesis.render(text)
                    await self._persist_turn(req, resp)
                    return resp

        # Stage 3 : fallback — réponse minimale
        return await self._synthesis.render(
            f"Je n'ai pas pu traiter ta demande « {req.text} » pour le moment. "
            "Essaie de reformuler ou réessaie plus tard.",
            degraded=True,
        )

    @staticmethod
    def _is_quota_exempt(text: str) -> bool:
        """Les salutations, remerciements et aide ne consomment pas de quota."""
        t = text.strip()
        return bool(_GREETING_RE.search(t) or _ACK_RE.search(t) or _HELP_RE.search(t))

    async def _merge_context(self, req: IncomingRequest) -> IncomingRequest:
        """Fusionne le contexte persistant avec celui de la requête."""
        if self._conversations is None:
            return req
        persisted = await self._conversations.get_context(req.user_id)
        ctx = req.context
        # Le contexte de la requête a priorité sur le persistant
        merged = persisted.model_copy(
            update={k: v for k, v in ctx.model_dump().items() if v is not None},
        )
        return req.model_copy(update={"context": merged})

    async def _get_conversation_history(
        self, user_id: str,
    ) -> list[dict[str, str]] | None:
        """Récupère l'historique récent pour l'orchestrateur."""
        if self._conversations is None:
            return None
        turns = await self._conversations.recent(user_id)
        if not turns:
            return None
        return [{"role": t.role, "content": t.text} for t in turns]

    async def _persist_turn(self, req: IncomingRequest, resp: Response) -> None:
        """Persiste le tour de conversation et consomme le quota."""
        if self._conversations is not None:
            async with guard("persist_turn", on_error=lambda: None):
                await self._conversations.append(req.user_id, "user", req.text)
                await self._conversations.append(req.user_id, "assistant", resp.text)

        if self._entitlements is not None and not self._is_quota_exempt(req.text):
            async with guard("consume_quota", on_error=lambda: None):
                await self._entitlements.consume(req.user_id, "chat_message")
