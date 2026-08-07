"""Tests de PERTINENCE — les réponses d'Oria correspondent-elles aux questions ?

Vérifie que :
- Le prerouter identifie correctement les intentions utilisateur
- Le pipeline route vers le bon handler
- Les réponses contiennent les bons attachments selon le type de question
- Les réponses dégradées sont cohérentes
- L'orchestrateur construit les bons messages système et contexte
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock

import pytest

from oria.config import Settings
from oria.core.orchestrator import Orchestrator
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.synthesis import Synthesis
from oria.kernel.models import Context, IncomingRequest, Response
from oria.tools.registry import ToolRegistry

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

FIXTURES_DIR = Path(__file__).parent / "fixtures" / "apifootball"


def _load_fixture(name: str) -> dict[str, Any]:
    return json.loads((FIXTURES_DIR / name).read_text())


def _make_request(
    text: str,
    *,
    league_id: int | None = None,
    team_id: int | None = None,
    season: int | None = None,
    fixture_id: int | None = None,
) -> IncomingRequest:
    return IncomingRequest(
        user_id="test-user",
        text=text,
        context=Context(
            league_id=league_id,
            team_id=team_id,
            season=season,
            fixture_id=fixture_id,
        ),
    )


def _make_settings() -> Settings:
    return Settings(
        apifootball_key="",
        deepseek_api_key="",
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        log_level="DEBUG",
        db_path=":memory:",
    )


# ---------------------------------------------------------------------------
# PREROUTER — Détection d'intentions
# ---------------------------------------------------------------------------


class TestPreRouterIntentDetection:
    """Le prerouter doit détecter les intentions triviales sans LLM."""

    @pytest.fixture
    def prerouter(self) -> PreRouter:
        return PreRouter()

    @pytest.mark.asyncio
    async def test_salutation_bonjour(self, prerouter: PreRouter) -> None:
        req = _make_request("Bonjour !")
        result = await prerouter.try_route(req)
        assert result is not None
        assert "Oria" in result.text
        assert len(result.suggested_actions) > 0

    @pytest.mark.asyncio
    async def test_salutation_hello(self, prerouter: PreRouter) -> None:
        req = _make_request("Hello")
        result = await prerouter.try_route(req)
        assert result is not None
        assert "Oria" in result.text

    @pytest.mark.asyncio
    async def test_salutation_salut(self, prerouter: PreRouter) -> None:
        req = _make_request("Salut")
        result = await prerouter.try_route(req)
        assert result is not None

    @pytest.mark.asyncio
    async def test_salutation_coucou(self, prerouter: PreRouter) -> None:
        req = _make_request("Coucou !")
        result = await prerouter.try_route(req)
        assert result is not None

    @pytest.mark.asyncio
    async def test_aide(self, prerouter: PreRouter) -> None:
        req = _make_request("aide")
        result = await prerouter.try_route(req)
        assert result is not None
        assert "classement" in result.text.lower() or "aider" in result.text.lower()

    @pytest.mark.asyncio
    async def test_help_english(self, prerouter: PreRouter) -> None:
        req = _make_request("help")
        result = await prerouter.try_route(req)
        assert result is not None

    @pytest.mark.asyncio
    async def test_question_complexe_non_interceptee(
        self, prerouter: PreRouter,
    ) -> None:
        """Les questions complexes ne doivent PAS être interceptées."""
        req = _make_request("Quel joueur a le meilleur ratio buts/match en Ligue 1 ?")
        result = await prerouter.try_route(req)
        assert result is None

    @pytest.mark.asyncio
    async def test_question_analytique_non_interceptee(
        self, prerouter: PreRouter,
    ) -> None:
        req = _make_request("Compare les défenses du PSG et du Real Madrid cette saison")
        result = await prerouter.try_route(req)
        assert result is None

    @pytest.mark.asyncio
    async def test_classement_detecte(self, prerouter: PreRouter) -> None:
        req = _make_request("classement ligue 1")
        result = await prerouter.try_route(req)
        # Sans tools, retourne None (pas de données)
        # Mais la détection doit fonctionner → on teste avec tools
        assert result is None  # pas de tools enregistrés

    @pytest.mark.asyncio
    async def test_prochain_match_detecte(self, prerouter: PreRouter) -> None:
        req = _make_request("prochain match du PSG")
        result = await prerouter.try_route(req)
        assert result is None  # pas de tools enregistrés


class TestPreRouterWithTools:
    """Prerouter avec outils mockés — vérifie la pertinence des réponses."""

    @pytest.fixture
    def mock_registry(self) -> ToolRegistry:
        registry = ToolRegistry()

        async def mock_standings(**kwargs: Any) -> list[dict[str, Any]]:
            return [
                {"rank": 1, "team": {"name": "PSG"}, "points": 30},
                {"rank": 2, "team": {"name": "Monaco"}, "points": 22},
            ]

        async def mock_fixtures(**kwargs: Any) -> list[dict[str, Any]]:
            return [
                {
                    "id": 1001,
                    "home": {"name": "PSG"},
                    "away": {"name": "Lille"},
                    "date": "2024-08-18T19:00:00+00:00",
                },
            ]

        registry.register(
            "get_standings", "Classements", {"type": "object", "properties": {}}, mock_standings,
        )
        registry.register(
            "get_fixtures", "Matchs", {"type": "object", "properties": {}}, mock_fixtures,
        )
        return registry

    @pytest.fixture
    def prerouter(self, mock_registry: ToolRegistry) -> PreRouter:
        return PreRouter(tools=mock_registry)

    @pytest.mark.asyncio
    async def test_classement_retourne_table(self, prerouter: PreRouter) -> None:
        req = _make_request("classement", league_id=61, season=2024)
        result = await prerouter.try_route(req)
        assert result is not None
        assert "classement" in result.text.lower()
        assert len(result.attachments) == 1
        assert result.attachments[0].kind == "table"
        assert "standings" in result.attachments[0].data

    @pytest.mark.asyncio
    async def test_prochain_match_retourne_fixture_card(
        self, prerouter: PreRouter,
    ) -> None:
        req = _make_request("prochain match", team_id=85)
        result = await prerouter.try_route(req)
        assert result is not None
        assert len(result.attachments) == 1
        assert result.attachments[0].kind == "fixture_card"

    @pytest.mark.asyncio
    async def test_dernier_resultat_retourne_fixture_card(
        self, prerouter: PreRouter,
    ) -> None:
        req = _make_request("dernier résultat", team_id=85)
        result = await prerouter.try_route(req)
        assert result is not None
        assert result.attachments[0].kind == "fixture_card"

    @pytest.mark.asyncio
    async def test_forme_recente_retourne_table(
        self, prerouter: PreRouter,
    ) -> None:
        req = _make_request("forme du PSG", team_id=85)
        result = await prerouter.try_route(req)
        assert result is not None
        assert result.attachments[0].kind == "table"
        assert "form" in result.attachments[0].data

    @pytest.mark.asyncio
    async def test_calendrier_retourne_table(
        self, prerouter: PreRouter,
    ) -> None:
        req = _make_request("calendrier Ligue 1", league_id=61)
        result = await prerouter.try_route(req)
        assert result is not None
        assert "prochains matchs" in result.text.lower()
        assert result.attachments[0].kind == "table"

    @pytest.mark.asyncio
    async def test_standings_en_anglais(self, prerouter: PreRouter) -> None:
        req = _make_request("standings", league_id=61, season=2024)
        result = await prerouter.try_route(req)
        assert result is not None
        assert result.attachments[0].kind == "table"


# ---------------------------------------------------------------------------
# PIPELINE — Pertinence du routage
# ---------------------------------------------------------------------------


class TestPipelinePertinence:
    """Le pipeline route correctement vers prerouter vs orchestrator."""

    @pytest.fixture
    def synthesis(self) -> Synthesis:
        return Synthesis()

    @pytest.mark.asyncio
    async def test_fallback_quand_rien_ne_marche(
        self, synthesis: Synthesis,
    ) -> None:
        """Sans prerouter ni orchestrator, le pipeline renvoie un fallback cohérent."""
        pipeline = Pipeline(synthesis=synthesis)
        req = _make_request("classement ligue 1")
        resp = await pipeline.handle_message(req)
        assert resp is not None
        assert isinstance(resp, Response)
        assert resp.text  # pas de réponse vide
        assert resp.degraded is True

    @pytest.mark.asyncio
    async def test_salutation_via_pipeline(self, synthesis: Synthesis) -> None:
        """Les salutations passent par le prerouter et ne tombent pas en fallback."""
        prerouter = PreRouter()
        pipeline = Pipeline(synthesis=synthesis, prerouter=prerouter)
        req = _make_request("Bonjour !")
        resp = await pipeline.handle_message(req)
        assert "Oria" in resp.text
        assert resp.degraded is False

    @pytest.mark.asyncio
    async def test_pipeline_ne_leve_jamais(self, synthesis: Synthesis) -> None:
        """Le pipeline ne lève JAMAIS — même avec un prerouter cassé."""

        class BrokenPreRouter(PreRouter):
            async def try_route(self, req: IncomingRequest) -> Response | None:
                raise RuntimeError("BOOM")

        broken = BrokenPreRouter()
        pipeline = Pipeline(synthesis=synthesis, prerouter=broken)
        req = _make_request("classement")
        resp = await pipeline.handle_message(req)
        assert resp is not None
        assert isinstance(resp, Response)

    @pytest.mark.asyncio
    async def test_pipeline_quota_exceeded(self, synthesis: Synthesis) -> None:
        """Si les entitlements refusent, la réponse est un quota exceeded pertinent."""
        from oria.app.entitlements.models import Decision, DecisionKind

        mock_entitlements = AsyncMock()
        mock_entitlements.check.return_value = Decision(
            kind=DecisionKind.DENY,
            reason="Tu as atteint ta limite de 20 messages gratuits.",
        )

        pipeline = Pipeline(
            synthesis=synthesis,
            entitlements=mock_entitlements,
        )
        req = _make_request("classement")
        resp = await pipeline.handle_message(req)
        assert resp.degraded is True
        assert "limite" in resp.text or "20" in resp.text
        # Doit proposer l'upgrade
        assert any("premium" in a.label.lower() for a in resp.suggested_actions)


# ---------------------------------------------------------------------------
# ORCHESTRATOR — Pertinence du contexte
# ---------------------------------------------------------------------------


class TestOrchestratorPertinence:
    """L'orchestrateur construit les bons messages et le bon contexte."""

    def test_context_hint_complet(self) -> None:
        """Le hint de contexte inclut tous les IDs présents."""
        req = _make_request(
            "classement",
            league_id=61,
            team_id=85,
            season=2024,
        )
        hint = Orchestrator._build_context_hint(req)
        assert "league_id=61" in hint
        assert "team_id=85" in hint
        assert "season=2024" in hint

    def test_context_hint_vide(self) -> None:
        """Sans contexte, le hint est vide."""
        req = _make_request("bonjour")
        hint = Orchestrator._build_context_hint(req)
        assert hint == ""

    def test_context_hint_partiel(self) -> None:
        """Avec un contexte partiel, seuls les IDs présents apparaissent."""
        req = _make_request("classement", league_id=61)
        hint = Orchestrator._build_context_hint(req)
        assert "league_id=61" in hint
        assert "team_id" not in hint

    @pytest.mark.asyncio
    async def test_orchestrator_sans_llm_renvoie_none(self) -> None:
        """Sans LLM, l'orchestrateur renvoie None (pas de crash)."""
        orch = Orchestrator(llm=None, tools=None)
        req = _make_request("classement ligue 1")
        result = await orch.run(req)
        assert result is None

    @pytest.mark.asyncio
    async def test_orchestrator_avec_llm_mock(self) -> None:
        """L'orchestrateur retourne le texte du LLM quand il y a une réponse directe."""
        mock_llm = AsyncMock()
        mock_llm.complete.return_value = {
            "choices": [
                {
                    "message": {"content": "Le PSG est premier de Ligue 1."},
                    "finish_reason": "stop",
                },
            ],
        }

        orch = Orchestrator(llm=mock_llm, tools=None)
        req = _make_request("Qui est premier en Ligue 1 ?")
        result = await orch.run(req)
        assert result is not None
        assert "PSG" in result

    @pytest.mark.asyncio
    async def test_orchestrator_tool_calling_loop(self) -> None:
        """L'orchestrateur appelle les outils et renvoie la réponse finale."""
        call_count = 0

        async def mock_complete(
            messages: list[dict[str, Any]], tools: Any = None, model: str | None = None,
        ) -> dict[str, Any]:
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return {
                    "choices": [
                        {
                            "message": {
                                "content": "",
                                "tool_calls": [
                                    {
                                        "id": "call_1",
                                        "function": {
                                            "name": "get_standings",
                                            "arguments": '{"league_id": 61, "season": 2024}',
                                        },
                                    },
                                ],
                            },
                            "finish_reason": "tool_calls",
                        },
                    ],
                }
            return {
                "choices": [
                    {
                        "message": {"content": "Le PSG mène avec 30 pts."},
                        "finish_reason": "stop",
                    },
                ],
            }

        mock_llm = AsyncMock()
        mock_llm.complete.side_effect = mock_complete

        registry = ToolRegistry()

        async def mock_standings(**kwargs: Any) -> list[dict[str, Any]]:
            return [{"rank": 1, "team": {"name": "PSG"}, "points": 30}]

        registry.register(
            "get_standings",
            "Classements",
            {"type": "object", "properties": {}, "required": ["league_id", "season"]},
            mock_standings,
        )

        orch = Orchestrator(llm=mock_llm, tools=registry)
        req = _make_request("classement ligue 1", league_id=61, season=2024)
        result = await orch.run(req)
        assert result is not None
        assert "PSG" in result
        assert call_count == 2  # 1 tool call + 1 final response

    @pytest.mark.asyncio
    async def test_orchestrator_conversation_history(self) -> None:
        """L'historique de conversation est injecté dans les messages LLM."""
        captured_messages: list[dict[str, Any]] = []

        async def mock_complete(
            messages: list[dict[str, Any]], tools: Any = None, model: str | None = None,
        ) -> dict[str, Any]:
            captured_messages.extend(messages)
            return {
                "choices": [
                    {
                        "message": {"content": "Oui, le PSG mène toujours."},
                        "finish_reason": "stop",
                    },
                ],
            }

        mock_llm = AsyncMock()
        mock_llm.complete.side_effect = mock_complete

        orch = Orchestrator(llm=mock_llm, tools=None)
        req = _make_request("Et maintenant ?")
        history = [
            {"role": "user", "content": "Qui est premier en Ligue 1 ?"},
            {"role": "assistant", "content": "Le PSG est premier."},
        ]
        result = await orch.run(req, conversation_history=history)
        assert result is not None
        # L'historique doit être dans les messages
        roles = [m["role"] for m in captured_messages]
        assert "system" in roles
        assert roles.count("user") >= 2  # historique + requête actuelle

    @pytest.mark.asyncio
    async def test_orchestrator_llm_failure_returns_none(self) -> None:
        """Si le LLM échoue, l'orchestrateur renvoie None (pas de crash)."""
        mock_llm = AsyncMock()
        mock_llm.complete.side_effect = RuntimeError("LLM down")

        orch = Orchestrator(llm=mock_llm, tools=None)
        req = _make_request("classement")
        result = await orch.run(req)
        assert result is None


# ---------------------------------------------------------------------------
# SYNTHÈSE — Pertinence des réponses formatées
# ---------------------------------------------------------------------------


class TestSynthesisPertinence:
    """La synthèse produit des réponses toujours valides et pertinentes."""

    @pytest.fixture
    def synthesis(self) -> Synthesis:
        return Synthesis()

    @pytest.mark.asyncio
    async def test_render_basique(self, synthesis: Synthesis) -> None:
        resp = await synthesis.render("Le PSG mène.")
        assert resp.text == "Le PSG mène."
        assert resp.degraded is False
        assert resp.attachments == []

    @pytest.mark.asyncio
    async def test_render_degrade(self, synthesis: Synthesis) -> None:
        resp = await synthesis.render("Service indisponible", degraded=True)
        assert resp.degraded is True

    @pytest.mark.asyncio
    async def test_fallback_toujours_valide(self, synthesis: Synthesis) -> None:
        resp = await synthesis.fallback()
        assert resp.text
        assert resp.degraded is True
        assert "réessaie" in resp.text.lower() or "désolé" in resp.text.lower()

    @pytest.mark.asyncio
    async def test_quota_exceeded_propose_upgrade(self, synthesis: Synthesis) -> None:
        resp = await synthesis.quota_exceeded("Limite atteinte")
        assert resp.degraded is True
        assert len(resp.suggested_actions) > 0
        assert any("premium" in a.label.lower() for a in resp.suggested_actions)


# ---------------------------------------------------------------------------
# TOOL REGISTRY — Pertinence des schémas
# ---------------------------------------------------------------------------


class TestToolRegistryPertinence:
    """Le registre d'outils expose les bons schémas au LLM."""

    def test_schemas_complets(self) -> None:
        """Les schémas JSON sont valides pour le function-calling."""
        registry = ToolRegistry()

        async def dummy(**kwargs: Any) -> None:
            pass

        registry.register(
            "get_fixtures",
            "Récupère les matchs",
            {
                "type": "object",
                "properties": {
                    "league_id": {"type": "integer", "description": "ID de la ligue"},
                },
            },
            dummy,
        )
        schemas = registry.schemas()
        assert len(schemas) == 1
        assert schemas[0]["type"] == "function"
        assert schemas[0]["function"]["name"] == "get_fixtures"
        assert "properties" in schemas[0]["function"]["parameters"]

    @pytest.mark.asyncio
    async def test_call_outil_inconnu_leve_keyerror(self) -> None:
        registry = ToolRegistry()
        with pytest.raises(KeyError, match="unknown tool"):
            await registry.call("inexistant", {})
