"""Modèles du module entitlements."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel


class DecisionKind(StrEnum):
    ALLOW = "allow"
    DENY = "deny"
    UPGRADE_REQUIRED = "upgrade_required"


class Decision(BaseModel):
    kind: DecisionKind
    reason: str = ""
    feature: str = ""


class UsageSnapshot(BaseModel):
    user_id: str
    day: str
    counters: dict[str, int] = {}


class FeatureLimits(BaseModel):
    chat_message: int = 20
    live_realtime: bool = False
    alert: int = 1
    deep_analysis: bool = False
    history_days: int = 7
