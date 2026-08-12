"""Outils applicatifs — pont chat vers services follow, quota, notifications."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from oria.app.entitlements.service import Entitlements
    from oria.app.preferences.service import FollowService, NotificationSettingsService
    from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def register_app_service_tools(  # noqa: PLR0915
    registry: ToolRegistry,
    *,
    follow_service: FollowService,
    notif_settings_service: NotificationSettingsService,
    entitlements: Entitlements,
) -> None:
    """Enregistre les outils applicatifs dans le registre."""

    # ---- follow_entity ----
    async def follow_entity(
        user_id: str = "",
        entity_type: str = "",
        entity_id: int = 0,
        entity_name: str = "",
    ) -> Any:  # noqa: ANN401
        result = await follow_service.follow(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
            entity_name=entity_name,
        )
        return result.model_dump()

    registry.register(
        "follow_entity",
        "Ajoute un suivi pour l'utilisateur (équipe, ligue ou joueur).",
        {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "ID de l'utilisateur",
                },
                "entity_type": {
                    "type": "string",
                    "enum": ["league", "team", "player"],
                    "description": "Type d'entité à suivre",
                },
                "entity_id": {
                    "type": "integer",
                    "description": "ID de l'entité",
                },
                "entity_name": {
                    "type": "string",
                    "description": "Nom de l'entité (pour affichage)",
                },
            },
            "required": ["user_id", "entity_type", "entity_id"],
        },
        follow_entity,
    )

    # ---- unfollow_entity ----
    async def unfollow_entity(
        user_id: str = "",
        entity_type: str = "",
        entity_id: int = 0,
    ) -> Any:  # noqa: ANN401
        removed = await follow_service.unfollow(
            user_id=user_id,
            entity_type=entity_type,
            entity_id=entity_id,
        )
        return {"removed": removed}

    registry.register(
        "unfollow_entity",
        "Supprime un suivi pour l'utilisateur.",
        {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "ID de l'utilisateur",
                },
                "entity_type": {
                    "type": "string",
                    "enum": ["league", "team", "player"],
                    "description": "Type d'entité",
                },
                "entity_id": {
                    "type": "integer",
                    "description": "ID de l'entité",
                },
            },
            "required": ["user_id", "entity_type", "entity_id"],
        },
        unfollow_entity,
    )

    # ---- list_follows ----
    async def list_follows(
        user_id: str = "",
        entity_type: str = "",
    ) -> Any:  # noqa: ANN401
        follows = await follow_service.list_follows(
            user_id=user_id,
            entity_type=entity_type or None,
        )
        return [f.model_dump() for f in follows]

    registry.register(
        "list_follows",
        "Liste les entités suivies par l'utilisateur.",
        {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "ID de l'utilisateur",
                },
                "entity_type": {
                    "type": "string",
                    "enum": ["league", "team", "player"],
                    "description": "Filtrer par type (optionnel)",
                },
            },
            "required": ["user_id"],
        },
        list_follows,
    )

    # ---- check_quota ----
    async def check_quota(
        user_id: str = "",
    ) -> Any:  # noqa: ANN401
        snapshot = await entitlements.usage(user_id)
        return snapshot.model_dump()

    registry.register(
        "check_quota",
        "Vérifie le quota et l'utilisation de l'utilisateur.",
        {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "ID de l'utilisateur",
                },
            },
            "required": ["user_id"],
        },
        check_quota,
    )

    # ---- get_notification_settings ----
    async def get_notification_settings(
        user_id: str = "",
    ) -> Any:  # noqa: ANN401
        ns = await notif_settings_service.get(user_id)
        return ns.model_dump()

    registry.register(
        "get_notification_settings",
        "Récupère les réglages de notifications de l'utilisateur.",
        {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "ID de l'utilisateur",
                },
            },
            "required": ["user_id"],
        },
        get_notification_settings,
    )

    # ---- update_notification_settings ----
    async def update_notification_settings(
        user_id: str = "",
        prematch: bool | None = None,
        result: bool | None = None,
        lineup: bool | None = None,
        live_goal: bool | None = None,
        digest: bool | None = None,
        quiet_start: str | None = None,
        quiet_end: str | None = None,
    ) -> Any:  # noqa: ANN401
        fields: dict[str, object] = {}
        if prematch is not None:
            fields["prematch"] = prematch
        if result is not None:
            fields["result"] = result
        if lineup is not None:
            fields["lineup"] = lineup
        if live_goal is not None:
            fields["live_goal"] = live_goal
        if digest is not None:
            fields["digest"] = digest
        if quiet_start is not None:
            fields["quiet_start"] = quiet_start
        if quiet_end is not None:
            fields["quiet_end"] = quiet_end
        ns = await notif_settings_service.update(user_id, **fields)
        return ns.model_dump()

    registry.register(
        "update_notification_settings",
        "Met à jour les réglages de notifications de l'utilisateur.",
        {
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "ID de l'utilisateur",
                },
                "prematch": {
                    "type": "boolean",
                    "description": "Notifier avant les matchs",
                },
                "result": {
                    "type": "boolean",
                    "description": "Notifier les résultats",
                },
                "lineup": {
                    "type": "boolean",
                    "description": "Notifier les compositions",
                },
                "live_goal": {
                    "type": "boolean",
                    "description": "Notifier les buts en direct",
                },
                "digest": {
                    "type": "boolean",
                    "description": "Recevoir le digest quotidien",
                },
                "quiet_start": {
                    "type": "string",
                    "description": "Début de la plage silencieuse (HH:MM)",
                },
                "quiet_end": {
                    "type": "string",
                    "description": "Fin de la plage silencieuse (HH:MM)",
                },
            },
            "required": ["user_id"],
        },
        update_notification_settings,
    )
