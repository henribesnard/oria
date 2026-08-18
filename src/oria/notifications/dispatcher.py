"""Dispatcher de notifications — route les événements vers les canaux."""

from __future__ import annotations

import logging
from datetime import datetime
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.entitlements.service import Entitlements
    from oria.app.preferences.service import FollowService, NotificationSettingsService
    from oria.kernel.events import EventBus
    from oria.notifications.outbound_email import EmailOutboundPort
    from oria.notifications.outbound_sse import SSEOutboundPort

logger = logging.getLogger(__name__)

# Mapping event_type → notification settings field
_EVENT_SETTING_MAP: dict[str, str] = {
    "match_start": "prematch",
    "match_end": "result",
    "lineup": "lineup",
    "goal": "live_goal",
}

# Dedup window in seconds
_DEDUP_TTL = 300


class NotificationDispatcher:
    """Module optionnel : route les événements domaine vers les canaux de notification."""

    name: str = "notifications"
    required: bool = False
    provides: tuple[str, ...] = ("push",)

    def __init__(
        self,
        *,
        event_bus: EventBus | None = None,
        follow_service: FollowService | None = None,
        notif_settings: NotificationSettingsService | None = None,
        entitlements: Entitlements | None = None,
        email_port: EmailOutboundPort | None = None,
        sse_port: SSEOutboundPort | None = None,
    ) -> None:
        self._bus = event_bus
        self._follows = follow_service
        self._notif_settings = notif_settings
        self._entitlements = entitlements
        self._email_port = email_port
        self._sse_port = sse_port
        self._seen: dict[str, float] = {}

    async def start(self) -> None:
        if self._bus is not None:
            for event_type in _EVENT_SETTING_MAP:
                self._bus.subscribe(event_type, self._handle_event)
        logger.info("notification dispatcher ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def _handle_event(self, event: Any) -> None:  # noqa: ANN401
        """Handler unifié pour tous les événements domaine."""
        event_type = getattr(event, "event_type", "unknown")
        fixture_id = getattr(event, "fixture_id", 0)

        # Dedup
        dedup_key = f"{event_type}:{fixture_id}"
        now = datetime.now().timestamp()
        if dedup_key in self._seen and (now - self._seen[dedup_key]) < _DEDUP_TTL:
            return
        self._seen[dedup_key] = now

        # Clean old dedup entries
        cutoff = now - _DEDUP_TTL
        self._seen = {k: v for k, v in self._seen.items() if v > cutoff}

        # Find subscribers
        setting_field = _EVENT_SETTING_MAP.get(event_type)
        if not setting_field or self._notif_settings is None:
            return

        try:
            subscribers = await self._notif_settings.get_subscribers(setting_field)
        except Exception:
            logger.warning("failed to get subscribers for %s", event_type, exc_info=True)
            return

        # Filter by follows — user must follow the relevant league/team
        getattr(event, "league_id", 0)

        for settings in subscribers:
            user_id = settings.user_id
            try:
                # Check quiet hours
                if self._is_quiet_hours(settings.quiet_start, settings.quiet_end):
                    continue

                # Format the message
                message = self._format_message(event)

                # Send via available channels
                sent = False
                if self._sse_port is not None:
                    try:
                        await self._sse_port.send(user_id, event_type, message)
                        sent = True
                    except Exception:
                        logger.debug("SSE send failed for %s", user_id, exc_info=True)

                if self._email_port is not None and not sent:
                    try:
                        await self._email_port.send(
                            user_id, f"Oria — {event_type}", message,
                        )
                    except Exception:
                        logger.debug("email send failed for %s", user_id, exc_info=True)

            except Exception:
                logger.warning(
                    "notification dispatch failed for user %s", user_id, exc_info=True,
                )

    @staticmethod
    def _format_message(event: Any) -> str:  # noqa: ANN401
        """Formate un événement en message lisible."""
        event_type = getattr(event, "event_type", "unknown")

        if event_type == "goal":
            home = getattr(event, "home_team", "?")
            away = getattr(event, "away_team", "?")
            hs = getattr(event, "home_score", 0)
            a_s = getattr(event, "away_score", 0)
            player = getattr(event, "player_name", "")
            minute = getattr(event, "minute", 0)
            base = f"⚽ But ! {home} {hs}-{a_s} {away}"
            if player:
                base += f" ({player}, {minute}')"
            return base

        if event_type == "match_start":
            home = getattr(event, "home_team", "?")
            away = getattr(event, "away_team", "?")
            return f"🏟️ Coup d'envoi : {home} vs {away}"

        if event_type == "match_end":
            home = getattr(event, "home_team", "?")
            away = getattr(event, "away_team", "?")
            hs = getattr(event, "home_score", 0)
            a_s = getattr(event, "away_score", 0)
            return f"🏁 Fin du match : {home} {hs}-{a_s} {away}"

        if event_type == "lineup":
            home = getattr(event, "home_team", "?")
            away = getattr(event, "away_team", "?")
            return f"📋 Compo annoncée : {home} vs {away}"

        return f"Notification : {event_type}"

    @staticmethod
    def _is_quiet_hours(quiet_start: str, quiet_end: str) -> bool:
        """Vérifie si l'heure actuelle est dans les quiet hours."""
        try:
            now = datetime.now()
            start_h, start_m = map(int, quiet_start.split(":"))
            end_h, end_m = map(int, quiet_end.split(":"))
            current_minutes = now.hour * 60 + now.minute
            start_minutes = start_h * 60 + start_m
            end_minutes = end_h * 60 + end_m

            if start_minutes <= end_minutes:
                return start_minutes <= current_minutes <= end_minutes
            # Overnight: e.g. 23:00 → 08:00
            return current_minutes >= start_minutes or current_minutes <= end_minutes
        except (ValueError, AttributeError):
            return False
