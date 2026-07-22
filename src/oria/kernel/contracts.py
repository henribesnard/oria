"""Contrats (Protocols) — interfaces de tous les modules et ports."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Protocol, runtime_checkable

if TYPE_CHECKING:
    from oria.kernel.health import ModuleStatus
    from oria.kernel.models import IncomingRequest, Response


# ---------------------------------------------------------------------------
# Module
# ---------------------------------------------------------------------------


@runtime_checkable
class Module(Protocol):
    """Contrat commun à tout module Oria."""

    name: str
    required: bool
    provides: tuple[str, ...]

    async def start(self) -> None: ...
    async def stop(self) -> None: ...
    async def health(self) -> ModuleStatus: ...


# ---------------------------------------------------------------------------
# Ports
# ---------------------------------------------------------------------------


@runtime_checkable
class InboundPort(Protocol):
    """Point d'entrée de requête (pipeline)."""

    async def handle_message(self, req: IncomingRequest) -> Response: ...


@runtime_checkable
class OutboundPort(Protocol):
    """Sortie vers un canal (push/réponse)."""

    async def send(self, user_id: str, message: Response) -> None: ...


# ---------------------------------------------------------------------------
# Data
# ---------------------------------------------------------------------------


@runtime_checkable
class Repository(Protocol):
    """Accès cache-first à un domaine de données."""

    volatility: str  # "immuable" | "lent" | "semi_rapide" | "live"

    async def get(self, key: str, *, allow_stale: bool = True) -> Any: ...


@runtime_checkable
class DataProvider(Protocol):
    """Fournisseur externe (API-Football, LLM, météo)."""

    async def health(self) -> ModuleStatus: ...
