"""Registre de santé et de capacités."""

from __future__ import annotations

import threading
from enum import StrEnum
from typing import Any

from pydantic import BaseModel


class Availability(StrEnum):
    """État de disponibilité d'un module."""

    UP = "up"
    DEGRADED = "degraded"
    DOWN = "down"


class ModuleStatus(BaseModel):
    """Statut instantané d'un module."""

    name: str
    availability: Availability
    detail: str | None = None
    details: dict[str, Any] | None = None


class HealthRegistry:
    """Registre centralisé de santé — thread-safe, injecté partout."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._statuses: dict[str, ModuleStatus] = {}
        self._capabilities: dict[str, set[str]] = {}  # capability -> set of module names

    # -- mutations --

    def set(self, status: ModuleStatus) -> None:
        with self._lock:
            self._statuses[status.name] = status

    def register_capabilities(self, module_name: str, capabilities: tuple[str, ...]) -> None:
        with self._lock:
            for cap in capabilities:
                self._capabilities.setdefault(cap, set()).add(module_name)

    # -- lectures --

    def get(self, name: str) -> ModuleStatus | None:
        with self._lock:
            return self._statuses.get(name)

    def snapshot(self) -> dict[str, ModuleStatus]:
        with self._lock:
            return dict(self._statuses)

    def capability_available(self, capability: str) -> bool:
        """Une capacité est disponible si au moins un module UP la fournit."""
        with self._lock:
            providers = self._capabilities.get(capability, set())
            return any(
                (s := self._statuses.get(mod)) is not None and s.availability == Availability.UP
                for mod in providers
            )
