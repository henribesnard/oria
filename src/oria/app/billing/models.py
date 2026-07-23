"""Modèles du module billing."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel


class Tier(StrEnum):
    FREE = "free"
    PREMIUM = "premium"


class SubscriptionStatus(StrEnum):
    ACTIVE = "active"
    PAST_DUE = "past_due"
    CANCELED = "canceled"


class Subscription(BaseModel):
    user_id: str
    tier: Tier = Tier.FREE
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE
    stripe_customer_id: str | None = None
    stripe_sub_id: str | None = None
    current_period_end: float | None = None
    cancel_at_period_end: bool = False
    updated_at: float = 0.0


class BillingEvent(BaseModel):
    id: str
    user_id: str | None = None
    type: str
    stripe_event_id: str | None = None
    received_at: float = 0.0
