"""Registre d'outils exposés au LLM (schéma JSON + validation)."""

from __future__ import annotations

import logging
from collections.abc import Callable, Coroutine
from typing import Any

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)

# Type d'un outil : async (args: dict) -> Any
type ToolFn = Callable[..., Coroutine[Any, Any, Any]]


class ToolDef:
    """Définition d'un outil."""

    def __init__(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        fn: ToolFn,
    ) -> None:
        self.name = name
        self.description = description
        self.parameters = parameters
        self.fn = fn

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
        self._oldest_fetched_at: float | None = None

    async def start(self) -> None:
        logger.info("tool registry ready", extra={"tool_count": len(self._tools)})

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    def reset_freshness(self) -> None:
        """Réinitialise le suivi de fraîcheur pour un nouveau cycle de requête."""
        self._oldest_fetched_at = None

    def record_fetched_at(self, fetched_at: float) -> None:
        """Enregistre un timestamp de fraîcheur. Conserve le plus ancien."""
        if self._oldest_fetched_at is None or fetched_at < self._oldest_fetched_at:
            self._oldest_fetched_at = fetched_at

    @property
    def freshness_label(self) -> str | None:
        """Libellé de fraîcheur basé sur la donnée la plus ancienne servie."""
        if self._oldest_fetched_at is None:
            return None
        import time
        age = time.time() - self._oldest_fetched_at
        if age < 60:
            return "à l'instant"
        if age < 3600:
            return f"il y a {int(age // 60)} min"
        if age < 86400:
            return f"il y a {int(age // 3600)} h"
        return f"il y a {int(age // 86400)} j"

    def register(
        self,
        name: str,
        description: str,
        parameters: dict[str, Any],
        fn: ToolFn,
    ) -> None:
        self._tools[name] = ToolDef(name, description, parameters, fn)

    def get(self, name: str) -> ToolDef | None:
        return self._tools.get(name)

    def schemas(self) -> list[dict[str, Any]]:
        return [t.to_schema() for t in self._tools.values()]

    async def call(self, name: str, args: dict[str, Any]) -> Any:  # noqa: ANN401
        """Appelle un outil par nom. Lève KeyError si inconnu."""
        tool = self._tools.get(name)
        if tool is None:
            raise KeyError(f"unknown tool: {name}")
        return await tool.fn(**args)
