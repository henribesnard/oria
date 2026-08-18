"""Service identité — comptes + liaison multi-canal."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.app.identity.repository import IdentityRepository
from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.identity.models import User, UserRole
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class IdentityService:
    """Module identité : comptes et liaison d'identités multi-canal."""

    name: str = "identity"
    required: bool = True
    provides: tuple[str, ...] = ("identity",)

    def __init__(self, db: Database) -> None:
        self._repo = IdentityRepository(db)

    async def start(self) -> None:
        logger.info("identity service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    # -- API publique --

    async def resolve_or_create(
        self,
        provider: str,
        external_id: str,
        profile: dict[str, object] | None = None,
    ) -> User:
        """Idempotent : retrouve ou crée le user lié à (provider, external_id)."""
        identity = await self._repo.find_identity(provider, external_id)
        if identity is not None:
            user = await self._repo.get_user(identity.user_id)
            if user is not None:
                return user

        # Créer le user + l'identité
        display_name = ""
        locale = "fr"
        if profile:
            display_name = str(profile.get("display_name", ""))
            locale = str(profile.get("locale", "fr"))

        user = await self._repo.create_user(display_name=display_name, locale=locale)
        await self._repo.create_identity(
            user_id=user.id, provider=provider, external_id=external_id,
        )
        logger.info(
            "user created via resolve_or_create",
            extra={"user_id": user.id, "provider": provider},
        )
        return user

    async def link(self, user_id: str, provider: str, external_id: str) -> None:
        """Lie une identité externe supplémentaire au compte existant."""
        existing = await self._repo.find_identity(provider, external_id)
        if existing is not None:
            if existing.user_id == user_id:
                return  # Déjà lié, idempotent
            msg = f"identity ({provider}, {external_id}) already linked to another user"
            raise ValueError(msg)
        await self._repo.create_identity(
            user_id=user_id, provider=provider, external_id=external_id,
        )

    async def unlink(self, user_id: str, provider: str) -> None:
        """Détache une identité externe du compte."""
        # Vérifier qu'il reste au moins une identité
        identities = await self._repo.list_identities(user_id)
        remaining = [i for i in identities if i.provider != provider]
        if not remaining:
            msg = "cannot unlink last identity"
            raise ValueError(msg)
        await self._repo.delete_identity(user_id, provider)

    async def get(self, user_id: str) -> User | None:
        return await self._repo.get_user(user_id)

    async def get_identities(self, user_id: str) -> list[dict[str, str]]:
        identities = await self._repo.list_identities(user_id)
        return [
            {"provider": i.provider, "external_id": i.external_id}
            for i in identities
        ]

    async def update_profile(self, user_id: str, **fields: object) -> User | None:
        return await self._repo.update_user(user_id, **fields)

    async def delete_account(self, user_id: str) -> None:
        """Suppression RGPD : purge complète du compte et de toutes les données."""
        await self._repo.delete_user(user_id)
        logger.info("account deleted (RGPD)", extra={"user_id": user_id})

    async def set_role(self, user_id: str, role: UserRole) -> User | None:
        return await self._repo.update_user(user_id, role=role)

    # -- admin helpers --

    async def list_users(
        self, *, search: str | None = None, limit: int = 50, offset: int = 0,
    ) -> list[User]:
        return await self._repo.list_users(search=search, limit=limit, offset=offset)

    async def count_users(self) -> int:
        return await self._repo.count_users()
