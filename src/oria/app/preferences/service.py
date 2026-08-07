"""Service preferences — suivis et réglages notifications."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.app.preferences.models import AggregatedFollows, Follow, NotificationSettings
from oria.app.preferences.repository import PreferencesRepository
from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class FollowService:
    """Gestion des suivis (leagues, teams, players)."""

    name: str = "follows"
    required: bool = False
    provides: tuple[str, ...] = ("follows",)

    def __init__(self, db: Database) -> None:
        self._repo = PreferencesRepository(db)

    async def start(self) -> None:
        logger.info("follow service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def follow(
        self, user_id: str, entity_type: str, entity_id: int,
        entity_name: str = "", logo_url: str = "",
    ) -> Follow:
        return await self._repo.add_follow(
            user_id=user_id, entity_type=entity_type,
            entity_id=entity_id, entity_name=entity_name,
            logo_url=logo_url,
        )

    async def unfollow(
        self, user_id: str, entity_type: str, entity_id: int,
    ) -> bool:
        return await self._repo.remove_follow(user_id, entity_type, entity_id)

    async def list_follows(
        self, user_id: str, entity_type: str | None = None,
    ) -> list[Follow]:
        return await self._repo.list_follows(user_id, entity_type)

    async def aggregated_registry(self) -> AggregatedFollows:
        raw = await self._repo.aggregated_follows()
        return AggregatedFollows(
            league_ids=raw.get("league", []),
            team_ids=raw.get("team", []),
            player_ids=raw.get("player", []),
        )


class NotificationSettingsService:
    """Gestion des réglages de notifications par utilisateur."""

    name: str = "notification_settings"
    required: bool = False
    provides: tuple[str, ...] = ("notification_settings",)

    def __init__(self, db: Database) -> None:
        self._repo = PreferencesRepository(db)

    async def start(self) -> None:
        logger.info("notification settings service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def get(self, user_id: str) -> NotificationSettings:
        return await self._repo.get_notification_settings(user_id)

    async def update(self, user_id: str, **fields: object) -> NotificationSettings:
        ns = await self._repo.get_notification_settings(user_id)
        for k, v in fields.items():
            if hasattr(ns, k) and v is not None:
                setattr(ns, k, v)
        await self._repo.upsert_notification_settings(ns)
        return ns

    async def get_subscribers(self, event_type: str) -> list[NotificationSettings]:
        return await self._repo.get_subscribers(event_type)
