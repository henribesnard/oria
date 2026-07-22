"""Conteneur DI — construit et câble les modules."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import TYPE_CHECKING

from oria.kernel.events import EventBus
from oria.kernel.health import Availability, HealthRegistry, ModuleStatus

if TYPE_CHECKING:
    from oria.config import Settings
    from oria.kernel.contracts import Module

logger = logging.getLogger(__name__)


@dataclass
class Container:
    """Registre de tous les modules instanciés."""

    settings: Settings
    health: HealthRegistry = field(default_factory=HealthRegistry)
    bus: EventBus = field(default_factory=EventBus)
    modules: list[Module] = field(default_factory=list)

    def add(self, module: Module) -> None:
        self.modules.append(module)

    async def start_all(self) -> None:
        """Démarre les modules un par un, de façon tolérante."""
        for module in self.modules:
            try:
                await module.start()
                self.health.set(ModuleStatus(name=module.name, availability=Availability.UP))
                self.health.register_capabilities(module.name, module.provides)
                logger.info("module started", extra={"oria_module": module.name})
            except Exception:
                if module.required:
                    logger.critical(
                        "required module failed to start",
                        extra={"oria_module": module.name},
                        exc_info=True,
                    )
                    raise
                logger.warning(
                    "optional module failed to start — marked DOWN",
                    extra={"oria_module": module.name},
                    exc_info=True,
                )
                self.health.set(
                    ModuleStatus(
                        name=module.name,
                        availability=Availability.DOWN,
                        detail="start failed",
                    )
                )

    async def stop_all(self) -> None:
        """Arrête tous les modules dans l'ordre inverse."""
        for module in reversed(self.modules):
            try:
                await module.stop()
                logger.info("module stopped", extra={"oria_module": module.name})
            except Exception:
                logger.warning(
                    "module stop error",
                    extra={"oria_module": module.name},
                    exc_info=True,
                )
