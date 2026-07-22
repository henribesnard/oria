"""Gouverneur de quota API-Football (stub M3)."""

from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class Governor:
    """Gère le budget, rate limit, single-flight et negative cache."""

    def __init__(self, *, daily_budget: int, rate_per_min: int) -> None:
        self._daily_budget = daily_budget
        self._rate_per_min = rate_per_min
        self._calls_today = 0

    @property
    def remaining_budget(self) -> int:
        return max(0, self._daily_budget - self._calls_today)

    def can_call(self) -> bool:
        return self._calls_today < self._daily_budget

    def record_call(self) -> None:
        self._calls_today += 1
