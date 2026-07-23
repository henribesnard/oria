"""StripeProvider — stub pour le paiement."""

from __future__ import annotations

import logging

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class StripeProvider:
    """Fournisseur Stripe (stub). En production, utiliserait le SDK Stripe."""

    name: str = "stripe"
    required: bool = False
    provides: tuple[str, ...] = ("payments",)

    def __init__(self, *, secret_key: str = "") -> None:
        self._secret_key = secret_key

    async def start(self) -> None:
        logger.info("stripe provider ready (stub mode)")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP, detail="stub")
