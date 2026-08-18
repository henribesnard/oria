"""Tests du pipeline — handle_message ne lève jamais."""

from __future__ import annotations

import pytest

from oria.core.orchestrator import Orchestrator
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.synthesis import Synthesis
from oria.kernel.models import IncomingRequest, Response
from oria.providers.llm.deepseek import DeepSeekProvider


class TestPipeline:
    async def test_handle_message_returns_response(self) -> None:
        synthesis = Synthesis()
        pipeline = Pipeline(synthesis=synthesis)
        req = IncomingRequest(user_id="test", text="Bonjour")

        resp = await pipeline.handle_message(req)

        assert isinstance(resp, Response)
        assert "Bonjour" in resp.text

    async def test_handle_message_never_raises(self) -> None:
        """Même avec une synthèse qui crashe, on récupère une Response."""

        class BrokenSynthesis(Synthesis):
            async def render(self, text: str, *, degraded: bool = False) -> Response:
                raise RuntimeError("synthesis crashed")

            async def fallback(self, reason: str = "") -> Response:
                raise RuntimeError("fallback also crashed")

        pipeline = Pipeline(synthesis=BrokenSynthesis())  # type: ignore[arg-type]
        req = IncomingRequest(user_id="test", text="test")

        resp = await pipeline.handle_message(req)

        assert isinstance(resp, Response)
        assert resp.degraded is True

    async def test_llm_stub_never_returned(self) -> None:
        """P0: enable_llm=True + cle vide ne produit jamais 'stub LLM response'."""
        # Orchestrator sans LLM (llm=None car cle vide)
        orchestrator = Orchestrator(llm=None)
        prerouter = PreRouter()
        synthesis = Synthesis()
        pipeline = Pipeline(
            synthesis=synthesis,
            prerouter=prerouter,
            orchestrator=orchestrator,
        )
        req = IncomingRequest(
            user_id="test", text="Quel est le score de PSG ?",
        )

        resp = await pipeline.handle_message(req)

        assert isinstance(resp, Response)
        assert "stub LLM response" not in resp.text
        # Le prerouter ou le fallback doit repondre, pas le stub
        assert resp.text  # non vide

    async def test_deepseek_no_stub_without_client(self) -> None:
        """P0: DeepSeekProvider.complete() sans client ne produit pas de stub.

        Le decorateur @resilient intercepte l'erreur et renvoie le fallback
        {"choices": []} — jamais de texte stub.
        """
        provider = DeepSeekProvider(
            api_key="", model_fast="test", model_deep="test",
        )
        # Ne pas appeler start() — _client reste None

        result = await provider.complete(
            [{"role": "user", "content": "test"}],
        )
        # Le fallback @resilient renvoie des choices vides
        assert result == {"choices": []}
        # Pas de texte stub dans la reponse
        assert "stub" not in str(result)

    def test_orchestrator_is_llm_ready(self) -> None:
        """Orchestrator.is_llm_ready() est coherent."""
        orch_none = Orchestrator(llm=None)
        assert not orch_none.is_llm_ready()

        fake_llm = DeepSeekProvider(
            api_key="fake", model_fast="m", model_deep="m",
        )
        orch_with = Orchestrator(llm=fake_llm)
        assert orch_with.is_llm_ready()
