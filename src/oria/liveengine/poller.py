"""Poller individuel par match — fréquence adaptative."""

from __future__ import annotations

import asyncio
import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from oria.domain.live import LiveRepository
    from oria.kernel.events import EventBus

logger = logging.getLogger(__name__)

_FAST_INTERVAL = 30   # During active play
_SLOW_INTERVAL = 120  # During halftime or waiting


class MatchPoller:
    """Poller adaptatif pour un match en cours."""

    def __init__(
        self,
        fixture_id: int,
        *,
        live_repo: LiveRepository | None = None,
        event_bus: EventBus | None = None,
    ) -> None:
        self.fixture_id = fixture_id
        self._live_repo = live_repo
        self._event_bus = event_bus
        self._last_state: dict[str, Any] = {}
        self._interval = _FAST_INTERVAL

    async def poll_loop(self) -> None:
        """Boucle de polling pour ce match."""
        while True:
            try:
                await self._poll_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.warning("poller %d tick failed", self.fixture_id, exc_info=True)
            await asyncio.sleep(self._interval)

    async def _poll_once(self) -> None:
        """Un cycle de polling."""
        if self._live_repo is None:
            return

        data = await self._live_repo.get(str(self.fixture_id), allow_stale=False)
        if not data:
            return

        # data is a list, find our fixture
        fixture = None
        if isinstance(data, list):
            for f in data:
                fid = f.get("fixture_id") or f.get("id")
                if fid and int(fid) == self.fixture_id:
                    fixture = f
                    break
        elif isinstance(data, dict):
            fixture = data

        if fixture is None:
            return

        # Detect changes and emit events
        self._detect_changes(fixture)
        self._last_state = fixture

        # Adapt interval based on match status
        status = str(fixture.get("status", "")).upper()
        if status in ("HT", "BT", "P", "SUSP"):
            self._interval = _SLOW_INTERVAL
        else:
            self._interval = _FAST_INTERVAL

    def _detect_changes(self, current: dict[str, Any]) -> None:
        """Compare avec l'état précédent et émet des événements."""
        if not self._last_state or self._event_bus is None:
            return

        prev_goals_home = self._last_state.get("goals_home", 0) or 0
        prev_goals_away = self._last_state.get("goals_away", 0) or 0
        curr_goals_home = current.get("goals_home", 0) or 0
        curr_goals_away = current.get("goals_away", 0) or 0

        if curr_goals_home > prev_goals_home or curr_goals_away > prev_goals_away:
            from oria.domain.events import GoalEvent
            self._event_bus.publish("goal", GoalEvent(
                fixture_id=self.fixture_id,
                home_team=str(current.get("home_team", "")),
                away_team=str(current.get("away_team", "")),
                home_score=curr_goals_home,
                away_score=curr_goals_away,
            ))
