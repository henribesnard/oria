"""Service admin — gestion des utilisateurs et bootstrap admin."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from oria.app.identity.models import User, UserRole
from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.auth.service import AuthService
    from oria.app.identity.service import IdentityService

logger = logging.getLogger(__name__)


class AdminService:
    """Module optionnel : administration des utilisateurs."""

    name: str = "admin"
    required: bool = False
    provides: tuple[str, ...] = ("admin",)

    def __init__(
        self,
        *,
        identity: IdentityService,
        auth: AuthService,
        bootstrap_token: str = "",
    ) -> None:
        self._identity = identity
        self._auth = auth
        self._bootstrap_token = bootstrap_token

    async def start(self) -> None:
        logger.info("admin service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def bootstrap_admin(
        self, token: str, email: str, password: str,
    ) -> User | None:
        """Crée le premier admin via ADMIN_BOOTSTRAP_TOKEN.

        Renvoie le User créé, ou None si le token est invalide.
        """
        if not self._bootstrap_token or token != self._bootstrap_token:
            return None

        # Créer l'utilisateur via auth (inscription normale)
        try:
            tokens = await self._auth.register_email(email, password)
        except ValueError:
            # Email déjà enregistré — récupérer l'utilisateur existant
            tokens = await self._auth.login_email(email, password)

        if not tokens:
            return None

        # Trouver le user_id depuis le token
        from oria.app.auth.security import decode_access_token

        payload = decode_access_token(tokens.access_token, self._auth._settings.jwt_secret)
        user_id = payload.get("sub", "")
        if not user_id:
            return None

        # Promouvoir en admin
        await self._identity.set_role(user_id, UserRole.ADMIN)
        return await self._identity.get(user_id)

    async def list_users(
        self, *, offset: int = 0, limit: int = 50,
    ) -> list[User]:
        """Liste les utilisateurs avec pagination."""
        return await self._identity.list_users(offset=offset, limit=limit)

    async def get_user(self, user_id: str) -> User | None:
        """Récupère un utilisateur par ID."""
        return await self._identity.get(user_id)

    async def update_user(
        self, user_id: str, **fields: object,
    ) -> User | None:
        """Met à jour les champs d'un utilisateur."""
        return await self._identity.update_profile(user_id, **fields)

    async def suspend_user(self, user_id: str) -> User | None:
        """Suspend un utilisateur."""
        return await self._identity.update_profile(user_id, status="suspended")

    async def user_count(self) -> int:
        """Nombre total d'utilisateurs."""
        return await self._identity.count_users()
