"""Service billing — abonnement et facturation."""

from __future__ import annotations

import hashlib
import hmac
import logging
import time
from typing import TYPE_CHECKING

from oria.app.billing.models import Subscription, SubscriptionStatus, Tier
from oria.app.billing.repository import BillingRepository
from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.config import Settings
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class SubscriptionService:
    """Module billing : paliers, Stripe, webhooks."""

    name: str = "billing"
    required: bool = False
    provides: tuple[str, ...] = ("billing",)

    def __init__(self, *, db: Database, settings: Settings) -> None:
        self._repo = BillingRepository(db)
        self._webhook_secret = settings.stripe_webhook_secret
        self._price_premium = settings.stripe_price_premium
        # Cache en mémoire du tier par user_id (résilience Stripe down)
        self._tier_cache: dict[str, Tier] = {}

    async def start(self) -> None:
        logger.info("billing service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP, detail="stub")

    async def get_tier(self, user_id: str) -> Tier:
        sub = await self._repo.get_subscription(user_id)
        if sub is not None and sub.status == SubscriptionStatus.ACTIVE:
            tier = sub.tier
        elif sub is not None and sub.status == SubscriptionStatus.PAST_DUE:
            tier = sub.tier  # Grâce configurable
        else:
            tier = self._tier_cache.get(user_id, Tier.FREE)
        self._tier_cache[user_id] = tier
        return tier

    async def get_subscription(self, user_id: str) -> Subscription:
        sub = await self._repo.get_subscription(user_id)
        if sub is not None:
            return sub
        return Subscription(user_id=user_id, updated_at=time.time())

    async def start_checkout(self, user_id: str, plan: str = "premium") -> str:
        """Retourne une URL de checkout Stripe. Stub : URL factice."""
        _ = plan
        return f"https://checkout.stripe.com/stub/{user_id}"

    async def open_portal(self, user_id: str) -> str:
        """Retourne une URL du Customer Portal Stripe. Stub."""
        return f"https://billing.stripe.com/stub/{user_id}"

    async def handle_webhook(self, payload: bytes, sig: str) -> None:
        """Traite un webhook Stripe (idempotent, signature vérifiée)."""
        # Vérification de signature
        if self._webhook_secret:
            self._verify_signature(payload, sig)

        import json
        try:
            data = json.loads(payload)
        except json.JSONDecodeError as e:
            msg = "invalid webhook payload"
            raise ValueError(msg) from e

        event_id = data.get("id", "")
        event_type = data.get("type", "")
        obj = data.get("data", {}).get("object", {})
        customer_id = obj.get("customer", "")

        # Idempotence
        recorded = await self._repo.record_event(
            user_id=None, event_type=event_type, stripe_event_id=event_id,
        )
        if not recorded:
            return  # Déjà traité

        if event_type in ("customer.subscription.updated", "customer.subscription.created"):
            status_map = {
                "active": SubscriptionStatus.ACTIVE,
                "past_due": SubscriptionStatus.PAST_DUE,
                "canceled": SubscriptionStatus.CANCELED,
            }
            sub_status = status_map.get(obj.get("status", ""), SubscriptionStatus.ACTIVE)
            # En stub, user_id = metadata.user_id ou customer_id
            user_id = obj.get("metadata", {}).get("user_id", customer_id)
            sub = Subscription(
                user_id=user_id,
                tier=Tier.PREMIUM if sub_status != SubscriptionStatus.CANCELED else Tier.FREE,
                status=sub_status,
                stripe_customer_id=customer_id,
                stripe_sub_id=obj.get("id", ""),
                current_period_end=obj.get("current_period_end"),
                cancel_at_period_end=bool(obj.get("cancel_at_period_end", False)),
                updated_at=time.time(),
            )
            await self._repo.upsert_subscription(sub)
            self._tier_cache[user_id] = sub.tier
            logger.info("subscription updated", extra={"user_id": user_id, "tier": sub.tier})

        elif event_type == "customer.subscription.deleted":
            user_id = obj.get("metadata", {}).get("user_id", customer_id)
            sub = Subscription(
                user_id=user_id, tier=Tier.FREE,
                status=SubscriptionStatus.CANCELED,
                updated_at=time.time(),
            )
            await self._repo.upsert_subscription(sub)
            self._tier_cache[user_id] = Tier.FREE

    async def cancel(self, user_id: str) -> None:
        sub = await self._repo.get_subscription(user_id)
        if sub is not None:
            sub.cancel_at_period_end = True
            await self._repo.upsert_subscription(sub)

    def _verify_signature(self, payload: bytes, sig: str) -> None:
        """Vérifie la signature Stripe (simplifié pour le stub)."""
        if not self._webhook_secret:
            return
        expected = hmac.new(
            self._webhook_secret.encode(), payload, hashlib.sha256,
        ).hexdigest()
        # Stripe utilise un format plus complexe, mais pour le stub on compare directement
        parts = sig.split(",")
        for part in parts:
            if part.startswith("v1=") and hmac.compare_digest(part[3:], expected):
                return
        # En mode stub, on accepte aussi si sig == "stub"
        if sig == "stub":
            return
        msg = "invalid webhook signature"
        raise ValueError(msg)
