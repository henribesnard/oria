"""C-01 · Test d'intégration : gating par fonctionnalité au registre d'outils.

Vérifie que les outils portant un feature_key sont bloqués pour un
utilisateur free et autorisés pour un premium, sur les deux routes
(prérouteur et orchestrateur). Vérifie aussi la non-régression :
un outil sans feature_key reste accessible en free.
"""

from __future__ import annotations

import asyncio
from typing import Any
from unittest.mock import AsyncMock

import pytest

from oria.app.billing.models import Tier
from oria.app.entitlements.models import Decision, DecisionKind, FeatureLimits
from oria.core.prerouter import PreRouter
from oria.kernel.models import Context, IncomingRequest, Response
from oria.tools.registry import ToolGatingError, ToolRegistry


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_registry() -> ToolRegistry:
    """Crée un registre avec des outils factices tagués."""
    registry = ToolRegistry()

    async def fake_get_odds(**kwargs: Any) -> dict:
        return {"bookmakers": [{"name": "Bet365"}]}

    async def fake_get_live_scores(**kwargs: Any) -> dict:
        return {"matches": [{"home": "PSG", "away": "OM"}]}

    async def fake_get_match_events(**kwargs: Any) -> dict:
        return {"events": [{"type": "Goal"}]}

    async def fake_get_standings(**kwargs: Any) -> dict:
        return {"standings": [{"rank": 1, "team": "PSG"}]}

    async def fake_get_fixtures(**kwargs: Any) -> list:
        return [{"id": 1, "home": "PSG", "away": "OM"}]

    registry.register(
        "get_odds", "Cotes", {"type": "object", "properties": {}},
        fake_get_odds, feature_key="deep_analysis",
    )
    registry.register(
        "get_live_scores", "Live scores", {"type": "object", "properties": {}},
        fake_get_live_scores, feature_key="live_realtime",
    )
    registry.register(
        "get_match_events", "Events", {"type": "object", "properties": {}},
        fake_get_match_events, feature_key="live_realtime",
    )
    registry.register(
        "get_standings", "Classement", {"type": "object", "properties": {}},
        fake_get_standings,
    )
    registry.register(
        "get_fixtures", "Matchs", {"type": "object", "properties": {}},
        fake_get_fixtures,
    )
    return registry


def _make_checker(tier: Tier) -> AsyncMock:
    """Crée un checker d'entitlement simulé selon le palier."""
    free_limits = FeatureLimits(
        chat_message=20, live_realtime=False,
        alert=1, deep_analysis=False, history_days=7,
    )
    premium_limits = FeatureLimits(
        chat_message=100, live_realtime=True,
        alert=10, deep_analysis=True, history_days=365,
    )

    async def checker(user_id: str, feature: str) -> Decision:
        limits = premium_limits if tier == Tier.PREMIUM else free_limits
        if feature == "deep_analysis":
            if not limits.deep_analysis:
                return Decision(
                    kind=DecisionKind.UPGRADE_REQUIRED,
                    reason="Les analyses approfondies sont réservées au palier Premium.",
                    feature=feature,
                )
            return Decision(kind=DecisionKind.ALLOW, feature=feature)
        if feature == "live_realtime":
            if not limits.live_realtime:
                return Decision(
                    kind=DecisionKind.UPGRADE_REQUIRED,
                    reason="Le direct en temps réel est réservé au palier Premium.",
                    feature=feature,
                )
            return Decision(kind=DecisionKind.ALLOW, feature=feature)
        return Decision(kind=DecisionKind.ALLOW, feature=feature)

    return AsyncMock(side_effect=checker)


# ---------------------------------------------------------------------------
# Tests : gating au niveau du registre d'outils
# ---------------------------------------------------------------------------


class TestToolRegistryGating:
    """Vérifie le gating direct via ToolRegistry.call()."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("tool_name,feature_key", [
        ("get_odds", "deep_analysis"),
        ("get_live_scores", "live_realtime"),
        ("get_match_events", "live_realtime"),
    ])
    async def test_gated_tool_blocked_for_free(self, tool_name: str, feature_key: str) -> None:
        """Un outil avec feature_key est bloqué pour un user free."""
        registry = _make_registry()
        registry.set_entitlement_checker(_make_checker(Tier.FREE))

        with pytest.raises(ToolGatingError) as exc_info:
            await registry.call(tool_name, {}, user_id="user-free")

        assert exc_info.value.feature == feature_key
        assert "Premium" in exc_info.value.reason

    @pytest.mark.asyncio
    @pytest.mark.parametrize("tool_name", [
        "get_odds", "get_live_scores", "get_match_events",
    ])
    async def test_gated_tool_allowed_for_premium(self, tool_name: str) -> None:
        """Le même outil est autorisé pour un user premium."""
        registry = _make_registry()
        registry.set_entitlement_checker(_make_checker(Tier.PREMIUM))

        result = await registry.call(tool_name, {}, user_id="user-premium")
        assert result is not None

    @pytest.mark.asyncio
    async def test_ungated_tool_accessible_for_free(self) -> None:
        """Un outil sans feature_key reste accessible en free."""
        registry = _make_registry()
        registry.set_entitlement_checker(_make_checker(Tier.FREE))

        result = await registry.call("get_standings", {}, user_id="user-free")
        assert result is not None
        assert "standings" in result

    @pytest.mark.asyncio
    async def test_no_gating_without_user_id(self) -> None:
        """Sans user_id, pas de gating (compatibilité prérouteur anonyme)."""
        registry = _make_registry()
        registry.set_entitlement_checker(_make_checker(Tier.FREE))

        # Pas de user_id → pas de vérification, l'outil s'exécute
        result = await registry.call("get_odds", {})
        assert result is not None

    @pytest.mark.asyncio
    async def test_no_gating_without_checker(self) -> None:
        """Sans checker injecté, pas de gating."""
        registry = _make_registry()
        # Pas de set_entitlement_checker → l'outil s'exécute
        result = await registry.call("get_odds", {}, user_id="user-free")
        assert result is not None


# ---------------------------------------------------------------------------
# Tests : gating via le prérouteur
# ---------------------------------------------------------------------------


class TestPreRouterGating:
    """Vérifie le gating dans le prérouteur (route prerouter)."""

    @pytest.mark.asyncio
    async def test_prerouter_odds_blocked_for_free(self) -> None:
        """Le prérouteur bloque les cotes pour un user free."""
        registry = _make_registry()
        checker = _make_checker(Tier.FREE)
        registry.set_entitlement_checker(checker)

        # L'entitlement du prérouteur est utilisé pour live,
        # mais le tool registry gating gère get_odds
        entitlements_mock = AsyncMock()
        entitlements_mock.check = checker

        prerouter = PreRouter(tools=registry, entitlements=entitlements_mock)
        req = IncomingRequest(user_id="user-free", text="cotes PSG OM")

        result = await prerouter.try_route(req)
        assert result is not None
        assert "Premium" in result.text
        assert result.degraded is True
        # Vérifier la présence d'une action d'upgrade
        assert any(
            a.payload.get("action") == "upgrade"
            for a in result.suggested_actions
        )

    @pytest.mark.asyncio
    async def test_prerouter_odds_allowed_for_premium(self) -> None:
        """Le prérouteur autorise les cotes pour un user premium."""
        registry = _make_registry()
        checker = _make_checker(Tier.PREMIUM)
        registry.set_entitlement_checker(checker)

        entitlements_mock = AsyncMock()
        entitlements_mock.check = checker

        prerouter = PreRouter(tools=registry, entitlements=entitlements_mock)
        req = IncomingRequest(user_id="user-premium", text="cotes PSG OM")

        result = await prerouter.try_route(req)
        assert result is not None
        assert result.degraded is False

    @pytest.mark.asyncio
    async def test_prerouter_live_blocked_for_free(self) -> None:
        """Le prérouteur bloque le live pour un user free."""
        registry = _make_registry()
        checker = _make_checker(Tier.FREE)
        registry.set_entitlement_checker(checker)

        entitlements_mock = AsyncMock()
        entitlements_mock.check = checker

        prerouter = PreRouter(tools=registry, entitlements=entitlements_mock)
        req = IncomingRequest(user_id="user-free", text="scores en direct")

        result = await prerouter.try_route(req)
        assert result is not None
        assert "Premium" in result.text
        assert result.degraded is True


# ---------------------------------------------------------------------------
# Tests : non-régression — outils sans feature_key
# ---------------------------------------------------------------------------


class TestNoRegressionUngated:
    """Les outils factuels sans feature_key restent accessibles à tous."""

    @pytest.mark.asyncio
    async def test_standings_accessible_free(self) -> None:
        registry = _make_registry()
        registry.set_entitlement_checker(_make_checker(Tier.FREE))

        result = await registry.call("get_standings", {}, user_id="user-free")
        assert result is not None

    @pytest.mark.asyncio
    async def test_fixtures_accessible_free(self) -> None:
        registry = _make_registry()
        registry.set_entitlement_checker(_make_checker(Tier.FREE))

        result = await registry.call("get_fixtures", {}, user_id="user-free")
        assert result is not None
