"""Service entitlements — quotas freemium et gating."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.app.billing.models import Tier
from oria.app.entitlements.models import Decision, DecisionKind, FeatureLimits, UsageSnapshot
from oria.app.entitlements.repository import EntitlementsRepository
from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.billing.service import SubscriptionService
    from oria.config import Settings
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class Entitlements:
    """Module entitlements : quotas freemium et gating de fonctionnalités."""

    name: str = "entitlements"
    required: bool = False
    provides: tuple[str, ...] = ("entitlements",)

    def __init__(
        self, *, db: Database, billing: SubscriptionService, settings: Settings,
    ) -> None:
        self._repo = EntitlementsRepository(db)
        self._billing = billing
        self._free_limits = FeatureLimits(
            chat_message=settings.free_daily_messages,
            live_realtime=settings.free_live_realtime,
            alert=settings.free_alerts,
            deep_analysis=settings.free_deep_analysis,
            history_days=settings.free_history_days,
        )
        self._premium_limits = FeatureLimits(
            chat_message=settings.premium_daily_messages,
            live_realtime=settings.premium_live_realtime,
            alert=settings.premium_alerts,
            deep_analysis=settings.premium_deep_analysis,
            history_days=settings.premium_history_days,
        )

    async def start(self) -> None:
        logger.info("entitlements service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    # -- Lecture / mise à jour des limites (pour le panel admin) --

    def get_limits(self) -> dict[str, dict[str, object]]:
        """Renvoie les limites actuelles free et premium."""
        return {
            "free": self._free_limits.model_dump(),
            "premium": self._premium_limits.model_dump(),
        }

    def update_limits(self, tier: str, **fields: object) -> dict[str, object]:
        """Met à jour les limites d'un palier (free ou premium) à chaud."""
        if tier == "free":
            for k, v in fields.items():
                if hasattr(self._free_limits, k):
                    setattr(self._free_limits, k, v)
            return self._free_limits.model_dump()
        if tier == "premium":
            for k, v in fields.items():
                if hasattr(self._premium_limits, k):
                    setattr(self._premium_limits, k, v)
            return self._premium_limits.model_dump()
        return {}

    # -- Logique métier --

    async def check(self, user_id: str, feature: str) -> Decision:
        tier = await self._billing.get_tier(user_id)
        limits = self._premium_limits if tier == Tier.PREMIUM else self._free_limits
        day = self._repo.today()

        if feature == "chat_message":
            used = await self._repo.get_usage(user_id, day, feature)
            if used >= limits.chat_message:
                if tier == Tier.FREE:
                    return Decision(
                        kind=DecisionKind.UPGRADE_REQUIRED,
                        reason=(
                            f"Quota atteint ({limits.chat_message} messages/jour). "
                            "Passe en Premium pour continuer."
                        ),
                        feature=feature,
                    )
                return Decision(
                    kind=DecisionKind.DENY,
                    reason="Quota journalier atteint.",
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

        if feature == "deep_analysis":
            if not limits.deep_analysis:
                return Decision(
                    kind=DecisionKind.UPGRADE_REQUIRED,
                    reason="Les analyses approfondies sont réservées au palier Premium.",
                    feature=feature,
                )
            return Decision(kind=DecisionKind.ALLOW, feature=feature)

        if feature == "alert":
            used = await self._repo.get_usage(user_id, day, feature)
            if used >= limits.alert and tier == Tier.FREE:
                return Decision(
                    kind=DecisionKind.UPGRADE_REQUIRED,
                    reason="Limite d'alertes atteinte en Free.",
                    feature=feature,
                )
            return Decision(kind=DecisionKind.ALLOW, feature=feature)

        # Feature inconnue : autoriser par défaut
        return Decision(kind=DecisionKind.ALLOW, feature=feature)

    async def consume(self, user_id: str, feature: str, n: int = 1) -> None:
        day = self._repo.today()
        await self._repo.increment(user_id, day, feature, n)

    async def usage(self, user_id: str) -> UsageSnapshot:
        day = self._repo.today()
        counters = await self._repo.get_all_usage(user_id, day)
        return UsageSnapshot(user_id=user_id, day=day, counters=counters)
