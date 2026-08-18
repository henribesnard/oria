"""Service d'authentification web."""

from __future__ import annotations

import logging
import time
from typing import TYPE_CHECKING

from oria.app.auth.models import TokenPair
from oria.app.auth.repository import AuthRepository
from oria.app.auth.security import (
    create_access_token,
    generate_token,
    hash_password,
    hash_token,
    verify_password,
)
from oria.kernel.health import Availability, ModuleStatus

if TYPE_CHECKING:
    from oria.app.identity.service import IdentityService
    from oria.config import Settings
    from oria.providers.mail import MailProvider
    from oria.storage.db import Database

logger = logging.getLogger(__name__)


class AuthService:
    """Module auth web : inscription, login, JWT, refresh, OAuth, reset."""

    name: str = "auth"
    required: bool = False
    provides: tuple[str, ...] = ("auth",)

    def __init__(
        self,
        *,
        db: Database,
        identity: IdentityService,
        mail: MailProvider,
        settings: Settings,
    ) -> None:
        self._repo = AuthRepository(db)
        self._identity = identity
        self._mail = mail
        self._jwt_secret = settings.jwt_secret
        self._access_ttl = settings.access_token_ttl_minutes
        self._refresh_ttl = settings.refresh_token_ttl_days
        # Rate-limit simple en mémoire : {key: [timestamps]}
        self._login_attempts: dict[str, list[float]] = {}
        self._max_attempts = 10
        self._window_seconds = 300.0  # 5 minutes

    async def start(self) -> None:
        logger.info("auth service ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    # -- inscription --

    async def register_email(
        self, email: str, password: str, *, locale: str = "fr",
    ) -> TokenPair:
        """Inscrit un utilisateur par email. Envoie un email de vérification."""
        email = email.lower().strip()

        # Vérifier que l'email n'est pas déjà utilisé
        existing = await self._repo.get_credential_by_email(email)
        if existing is not None:
            msg = "email already registered"
            raise ValueError(msg)

        # Créer le compte via identity
        user = await self._identity.resolve_or_create(
            "email", email, profile={"locale": locale},
        )

        # Créer les credentials
        pw_hash = hash_password(password)
        await self._repo.create_credential(
            user_id=user.id, email=email, password_hash=pw_hash,
        )

        # Envoyer l'email de vérification
        verify_token = generate_token()
        await self._repo.create_token(
            user_id=user.id, kind="email_verify",
            token_hash=hash_token(verify_token), ttl_seconds=86400,
        )
        await self._mail.send(
            to=email,
            subject="Oria — Confirme ton adresse email",
            body=f"Clique sur ce lien pour vérifier ton email : /auth/verify?token={verify_token}",
        )

        # Emettre les tokens
        return await self._create_token_pair(user.id, user.role)

    # -- login --

    async def login_email(
        self, email: str, password: str, *, ip: str = "", user_agent: str = "",
    ) -> TokenPair:
        """Authentifie par email/mot de passe."""
        email = email.lower().strip()

        # Rate-limit
        self._check_rate_limit(f"login:{email}")
        self._check_rate_limit(f"ip:{ip}")

        cred = await self._repo.get_credential_by_email(email)
        if cred is None or not verify_password(password, cred.password_hash):
            self._record_attempt(f"login:{email}")
            self._record_attempt(f"ip:{ip}")
            msg = "invalid credentials"
            raise ValueError(msg)

        user = await self._identity.get(cred.user_id)
        if user is None:
            msg = "account not found"
            raise ValueError(msg)

        return await self._create_token_pair(
            user.id, user.role, ip=ip, user_agent=user_agent,
        )

    # -- vérification email --

    async def verify_email(self, token: str) -> None:
        user_id = await self._repo.use_token(hash_token(token), "email_verify")
        if user_id is None:
            msg = "invalid or expired token"
            raise ValueError(msg)
        await self._repo.verify_email(user_id)

    # -- reset password --

    async def request_password_reset(self, email: str) -> None:
        """Envoie un email de reset. Ne révèle jamais si l'email existe."""
        cred = await self._repo.get_credential_by_email(email.lower().strip())
        if cred is None:
            return  # Réponse identique, ne pas révéler
        reset_token = generate_token()
        await self._repo.create_token(
            user_id=cred.user_id, kind="password_reset",
            token_hash=hash_token(reset_token), ttl_seconds=3600,
        )
        await self._mail.send(
            to=cred.email,
            subject="Oria — Réinitialise ton mot de passe",
            body=f"Lien de réinitialisation : /auth/reset?token={reset_token}",
        )

    async def reset_password(self, token: str, new_password: str) -> None:
        user_id = await self._repo.use_token(hash_token(token), "password_reset")
        if user_id is None:
            msg = "invalid or expired token"
            raise ValueError(msg)
        await self._repo.update_password(user_id, hash_password(new_password))
        # Révoquer toutes les sessions
        await self._repo.revoke_all_sessions(user_id)

    # -- OAuth --

    async def oauth_callback(
        self, provider: str, code: str,
    ) -> TokenPair:
        """Traite le retour OAuth. Stub : code = external_id."""
        # En production : échanger le code contre un token, récupérer le profil
        # Stub : le code EST l'external_id
        external_id = code
        user = await self._identity.resolve_or_create(provider, external_id)
        return await self._create_token_pair(user.id, user.role)

    # -- refresh --

    async def refresh(self, refresh_token: str) -> TokenPair:
        """Rotation du refresh token."""
        session = await self._repo.find_session_by_refresh(hash_token(refresh_token))
        if session is None or session.revoked_at is not None:
            msg = "invalid refresh token"
            raise ValueError(msg)
        if session.expires_at < time.time():
            msg = "refresh token expired"
            raise ValueError(msg)

        # Révoquer l'ancienne session
        await self._repo.revoke_session(session.id)

        user = await self._identity.get(session.user_id)
        if user is None:
            msg = "account not found"
            raise ValueError(msg)

        return await self._create_token_pair(user.id, user.role)

    # -- logout --

    async def logout(self, refresh_token: str) -> None:
        session = await self._repo.find_session_by_refresh(hash_token(refresh_token))
        if session is not None:
            await self._repo.revoke_session(session.id)

    # -- internals --

    async def _create_token_pair(
        self,
        user_id: str,
        role: str,
        *,
        ip: str = "",
        user_agent: str = "",
    ) -> TokenPair:
        access = create_access_token(
            user_id, role, secret=self._jwt_secret, ttl_minutes=self._access_ttl,
        )
        refresh = generate_token()

        await self._repo.create_session(
            user_id=user_id,
            refresh_token_hash=hash_token(refresh),
            ip=ip,
            user_agent=user_agent,
            ttl_days=self._refresh_ttl,
        )

        return TokenPair(
            access_token=access,
            refresh_token=refresh,
            expires_in=self._access_ttl * 60,
        )

    def _check_rate_limit(self, key: str) -> None:
        now = time.time()
        attempts = self._login_attempts.get(key, [])
        recent = [t for t in attempts if now - t < self._window_seconds]
        if len(recent) >= self._max_attempts:
            msg = "too many attempts, try again later"
            raise ValueError(msg)

    def _record_attempt(self, key: str) -> None:
        now = time.time()
        attempts = self._login_attempts.setdefault(key, [])
        attempts.append(now)
        # Garder seulement la fenêtre récente
        cutoff = now - self._window_seconds
        self._login_attempts[key] = [t for t in attempts if t > cutoff]
