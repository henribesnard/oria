"""Tests auth — session persistee avant retour, propagation d'erreur."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from oria.app.auth.service import AuthService
from oria.app.identity.service import IdentityService
from oria.config import Settings
from oria.providers.mail import MailProvider
from oria.storage.db import Database

if TYPE_CHECKING:
    from collections.abc import AsyncIterator


@pytest.fixture
async def auth_db() -> AsyncIterator[Database]:
    database = Database(db_path=":memory:")
    await database.start()
    yield database
    await database.stop()


@pytest.fixture
def auth_settings() -> Settings:
    return Settings(
        apifootball_key="",
        deepseek_api_key="",
        enable_llm=False,
        db_path=":memory:",
        jwt_secret="test-secret-with-enough-length-32b",
    )


@pytest.fixture
async def auth_service(auth_db: Database, auth_settings: Settings) -> AuthService:
    identity = IdentityService(db=auth_db)
    await identity.start()
    mail = MailProvider(
        smtp_host="", smtp_port=0, mail_from="test@test.com",
    )
    service = AuthService(
        db=auth_db, identity=identity, mail=mail, settings=auth_settings,
    )
    await service.start()
    return service


class TestSessionPersistence:
    """P0: la session doit etre persistee AVANT que le TokenPair soit retourne."""

    async def test_register_then_immediate_refresh(
        self, auth_service: AuthService,
    ) -> None:
        """Login puis refresh immediat — le refresh token doit etre valide."""
        pair = await auth_service.register_email(
            "user@example.com", "StrongP4ss!",
        )
        assert pair.access_token
        assert pair.refresh_token

        # Refresh immediat (meme tick) — doit reussir car la session
        # est persistee de facon synchrone (await) avant le retour
        new_pair = await auth_service.refresh(pair.refresh_token)
        assert new_pair.access_token
        assert new_pair.refresh_token
        # Les refresh tokens doivent etre differents (rotation)
        assert new_pair.refresh_token != pair.refresh_token

    async def test_login_then_immediate_refresh(
        self, auth_service: AuthService,
    ) -> None:
        """Register + login + refresh immediat."""
        await auth_service.register_email("u2@example.com", "Pass1234!")
        pair = await auth_service.login_email("u2@example.com", "Pass1234!")

        new_pair = await auth_service.refresh(pair.refresh_token)
        assert new_pair.refresh_token != pair.refresh_token

    async def test_session_error_propagates(
        self, auth_db: Database, auth_settings: Settings,
    ) -> None:
        """Si create_session leve, le login echoue proprement (pas de token orphelin)."""
        identity = IdentityService(db=auth_db)
        await identity.start()
        mail = MailProvider(smtp_host="", smtp_port=0, mail_from="t@t.com")
        service = AuthService(
            db=auth_db, identity=identity, mail=mail, settings=auth_settings,
        )
        await service.start()

        # Register first
        await service.register_email("err@example.com", "Pass1234!")

        # Fermer la base pour provoquer une erreur SQL sur create_session
        await auth_db.stop()

        with pytest.raises(Exception):
            await service.login_email("err@example.com", "Pass1234!")
