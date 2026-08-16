"""Registre d'outils exposés au LLM (schéma JSON + validation)."""

from __future__ import annotations

import logging
from collections.abc import Callable, Coroutine
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.entitlements.models import Decision

logger = logging.getLogger(__name__)

# Type d'un outil : async (args: dict) -> Any
type ToolFn = Callable[..., Coroutine[Any, Any, Any]]


class ToolGatingError(Exception):
    """Raised when a tool call is denied by entitlement gating."""

    def __init__(self, feature: str, reason: str) -> None:
        self.feature = feature
        self.reason = reason
        super().__init__(reason)


class ToolDef:
    """Définition d'un outil."""

    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        fn: ToolFn,
        *,
        feature_key: str | None = None,
    ) -> None:
        self.name = name
        self.description = description
        self.parameters = parameters
        self.fn = fn
        self.feature_key = feature_key

    def to_schema(self) -> dict[str, Any]:
        """Schéma JSON pour le function calling LLM."""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }


class ToolRegistry:
    """Module optionnel : enregistre et expose les outils."""

    name: str = "tools"
    required: bool = False
    provides: tuple[str, ...] = ("tools",)

    def __init__(self) -> None:
        self._tools: dict[str, ToolDef] = {}
        self._check_entitlement: Callable[..., Coroutine[Any, Any, Decision]] | None = None

    async def start(self) -> None:
        logger.info("tool registry ready", extra={"tool_count": len(self._tools)})

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    def set_entitlement_checker(
        self,
        checker: Callable[..., Coroutine[Any, Any, Decision]],
    ) -> None:
        """Injecte la fonction de vérification d'entitlement (user_id, feature) -> Decision."""
        self._check_entitlement = checker

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        fn: ToolFn,
        *,
        feature_key: str | None = None,
    ) -> None:
        self._tools[name] = ToolDef(name, description, parameters, fn, feature_key=feature_key)

    def get(self, name: str) -> ToolDef | None:
        return self._tools.get(name)

    def schemas(self) -> list[dict[str, Any]]:
        return [t.to_schema() for t in self._tools.values()]

    async def call(
        self,
        name: str,
        args: dict[str, Any],
        *,
        user_id: str = "",
    ) -> Any:  # noqa: ANN401
        """Appelle un outil par nom.

        Lève KeyError si inconnu, ToolGatingError si l'entitlement refuse.
        """
        tool = self._tools.get(name)
        if tool is None:
            raise KeyError(f"unknown tool: {name}")

        # Vérifier l'entitlement si l'outil porte un feature_key
        if tool.feature_key and user_id and self._check_entitlement is not None:
            from oria.app.entitlements.models import DecisionKind

            decision = await self._check_entitlement(user_id, tool.feature_key)
            if decision.kind != DecisionKind.ALLOW:
                raise ToolGatingError(
                    feature=tool.feature_key,
                    reason=decision.reason,
                )

        return await tool.fn(**args)
