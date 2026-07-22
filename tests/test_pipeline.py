"""Tests du pipeline — handle_message ne lève jamais."""

from __future__ import annotations

from oria.core.pipeline import Pipeline
from oria.core.synthesis import Synthesis
from oria.kernel.models import IncomingRequest, Response


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
