"""Tests C-09 — les follows utilisateur sont injectés dans le contexte orchestrateur."""

from __future__ import annotations

from unittest.mock import AsyncMock

import pytest

from oria.core.orchestrator import Orchestrator
from oria.core.pipeline import Pipeline
from oria.core.synthesis import Synthesis
from oria.kernel.models import Context, IncomingRequest


def _make_req(text: str = "mes résultats") -> IncomingRequest:
    return IncomingRequest(user_id="u1", text=text, context=Context())


class _FakeFollow:
    def __init__(self, entity_type: str, entity_id: int) -> None:
        self.entity_type = entity_type
        self.entity_id = entity_id


class TestContextFollowsFields:
    """Le modèle Context accepte les follows."""

    def test_default_empty(self) -> None:
        ctx = Context()
        assert ctx.followed_league_ids == []
        assert ctx.followed_team_ids == []

    def test_with_follows(self) -> None:
        ctx = Context(followed_league_ids=[61, 39], followed_team_ids=[85, 42])
        assert ctx.followed_league_ids == [61, 39]
        assert ctx.followed_team_ids == [85, 42]

    def test_serialization_roundtrip(self) -> None:
        ctx = Context(league_id=61, followed_team_ids=[85])
        data = ctx.model_dump()
        restored = Context.model_validate(data)
        assert restored.followed_team_ids == [85]
        assert restored.league_id == 61


class TestOrchestratorContextHint:
    """L'orchestrateur inclut les follows dans le context hint."""

    def test_hint_includes_followed_leagues(self) -> None:
        req = _make_req()
        req = req.model_copy(
            update={"context": Context(followed_league_ids=[61, 39])},
        )
        hint = Orchestrator._build_context_hint(req)
        assert "followed_leagues=[61, 39]" in hint

    def test_hint_includes_followed_teams(self) -> None:
        req = _make_req()
        req = req.model_copy(
            update={"context": Context(followed_team_ids=[85, 42])},
        )
        hint = Orchestrator._build_context_hint(req)
        assert "followed_teams=[85, 42]" in hint

    def test_hint_empty_when_no_follows(self) -> None:
        req = _make_req()
        hint = Orchestrator._build_context_hint(req)
        assert "followed" not in hint

    def test_hint_combines_context_and_follows(self) -> None:
        req = _make_req()
        req = req.model_copy(
            update={"context": Context(league_id=61, followed_team_ids=[85])},
        )
        hint = Orchestrator._build_context_hint(req)
        assert "league_id=61" in hint
        assert "followed_teams=[85]" in hint


class TestPipelineInjectsFollows:
    """La pipeline injecte les follows dans le contexte avant l'orchestrateur."""

    @pytest.mark.asyncio
    async def test_follows_injected_into_context(self) -> None:
        synthesis = Synthesis()

        # Mock follow service
        follow_service = AsyncMock()
        follow_service.list_follows.return_value = [
            _FakeFollow("league", 61),
            _FakeFollow("league", 39),
            _FakeFollow("team", 85),
        ]

        # Mock conversations service
        conversations = AsyncMock()
        conversations.get_context.return_value = Context()
        conversations.recent.return_value = []

        # Mock orchestrator
        orch = AsyncMock(spec=Orchestrator)
        orch.run.return_value = "Résultats de tes équipes."

        pipeline = Pipeline(
            synthesis=synthesis,
            orchestrator=orch,
            conversations=conversations,
            follow_service=follow_service,
        )
        req = _make_req("mes résultats")
        await pipeline.handle_message(req)

        # Check orchestrator was called with enriched context
        call_args = orch.run.call_args
        enriched_req = call_args[0][0]
        assert enriched_req.context.followed_league_ids == [61, 39]
        assert enriched_req.context.followed_team_ids == [85]

    @pytest.mark.asyncio
    async def test_no_follows_service_works(self) -> None:
        """Sans follow_service, le pipeline fonctionne normalement."""
        synthesis = Synthesis()
        orch = AsyncMock(spec=Orchestrator)
        orch.run.return_value = "Réponse simple."

        pipeline = Pipeline(synthesis=synthesis, orchestrator=orch)
        req = _make_req("salut")
        resp = await pipeline.handle_message(req)
        assert resp.text == "Réponse simple."

    @pytest.mark.asyncio
    async def test_follows_service_failure_graceful(self) -> None:
        """Si le follow_service échoue, le pipeline continue sans follows."""
        synthesis = Synthesis()

        follow_service = AsyncMock()
        follow_service.list_follows.side_effect = RuntimeError("db error")

        conversations = AsyncMock()
        conversations.get_context.return_value = Context()
        conversations.recent.return_value = []

        orch = AsyncMock(spec=Orchestrator)
        orch.run.return_value = "Réponse sans follows."

        pipeline = Pipeline(
            synthesis=synthesis,
            orchestrator=orch,
            conversations=conversations,
            follow_service=follow_service,
        )
        req = _make_req()
        resp = await pipeline.handle_message(req)
        # Should still work (guard protects context_merge)
        assert resp.text is not None
