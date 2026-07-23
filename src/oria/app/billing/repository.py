"""Couche d’accès données pour subscriptions et billing_events."""

from __future__ import annotations

import time
import uuid
from typing import TYPE_CHECKING

from oria.app.billing.models import (
    BillingEvent,
    Subscription,
    SubscriptionStatus,
    Tier,
)

if TYPE_CHECKING:
    from oria.storage.db import Database


class BillingRepository:
    def __init__(self, db: Database) -> None:
        self._db = db

    async def get_subscription(self, user_id: str) -> Subscription | None:
        cursor = await self._db.conn.execute(
            "SELECT user_id, tier, status, stripe_customer_id, stripe_sub_id, "
            "current_period_end, cancel_at_period_end, updated_at "
            "FROM subscriptions WHERE user_id = ?",
            (user_id,),
        )
        row = await cursor.fetchone()
        if row is None:
            return None
        return Subscription(
            user_id=row[0], tier=Tier(row[1]), status=SubscriptionStatus(row[2]),
            stripe_customer_id=row[3], stripe_sub_id=row[4],
            current_period_end=row[5], cancel_at_period_end=bool(row[6]),
            updated_at=row[7],
        )

    async def upsert_subscription(self, sub: Subscription) -> None:
        now = time.time()
        await self._db.conn.execute(
            "INSERT INTO subscriptions (user_id, tier, status, stripe_customer_id, "
            "stripe_sub_id, current_period_end, cancel_at_period_end, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?) "
            "ON CONFLICT(user_id) DO UPDATE SET "
            "tier=excluded.tier, status=excluded.status, "
            "stripe_customer_id=excluded.stripe_customer_id, "
            "stripe_sub_id=excluded.stripe_sub_id, "
            "current_period_end=excluded.current_period_end, "
            "cancel_at_period_end=excluded.cancel_at_period_end, "
            "updated_at=excluded.updated_at",
            (sub.user_id, sub.tier, sub.status, sub.stripe_customer_id,
             sub.stripe_sub_id, sub.current_period_end,
             int(sub.cancel_at_period_end), now),
        )
        await self._db.conn.commit()

    async def record_event(
        self, *, user_id: str | None, event_type: str, stripe_event_id: str,
    ) -> bool:
        """Enregistre un événement. Renvoie False si déjà enregistré (idempotence)."""
        try:
            await self._db.conn.execute(
                "INSERT INTO billing_events (id, user_id, type, stripe_event_id, received_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (uuid.uuid4().hex, user_id, event_type, stripe_event_id, time.time()),
            )
            await self._db.conn.commit()
            return True
        except Exception:
            return False
