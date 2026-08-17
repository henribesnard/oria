"""Adaptateur web FastAPI — routes publiques, auth, chat, admin, catalog, live."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI

from oria.adapters.web.account_routes import init_account_routes
from oria.adapters.web.account_routes import router as account_router
from oria.adapters.web.admin import init_admin_routes
from oria.adapters.web.admin import router as admin_router
from oria.adapters.web.auth_routes import init_auth_routes
from oria.adapters.web.auth_routes import router as auth_router
from oria.adapters.web.billing_routes import init_billing_routes
from oria.adapters.web.billing_routes import router as billing_router
from oria.adapters.web.catalog_routes import init_catalog_routes
from oria.adapters.web.catalog_routes import router as catalog_router
from oria.adapters.web.chat_routes import init_chat_routes
from oria.adapters.web.chat_routes import router as chat_router
from oria.adapters.web.dependencies import init_dependencies
from oria.adapters.web.errors import install_error_handlers
from oria.adapters.web.follows_routes import init_follows_routes
from oria.adapters.web.follows_routes import router as follows_router
from oria.adapters.web.live_routes import init_live_routes
from oria.adapters.web.live_routes import router as live_router
from oria.adapters.web.settings_routes import init_settings_routes
from oria.adapters.web.settings_routes import router as settings_router
from oria.kernel.health import Availability, HealthRegistry

# Sera injecté au démarrage par init_web
_health_registry: HealthRegistry | None = None


def _health_check() -> dict[str, Any]:
    if _health_registry is None:
        return {"status": "starting"}
    snapshot = _health_registry.snapshot()
    required_down = any(
        s.availability == Availability.DOWN
        for s in snapshot.values()
    )
    overall = "degraded" if required_down else "up"
    return {
        "status": overall,
        "modules": {name: s.model_dump() for name, s in snapshot.items()},
    }


def create_fastapi_app(*, lifespan: Any = None) -> FastAPI:
    """Factory : crée une instance FastAPI avec routers et error handlers."""
    instance = FastAPI(title="Oria", version="0.1.0", lifespan=lifespan)

    instance.include_router(admin_router)
    instance.include_router(auth_router)
    instance.include_router(account_router)
    instance.include_router(billing_router)
    instance.include_router(follows_router)
    instance.include_router(settings_router)
    instance.include_router(chat_router)
    instance.include_router(catalog_router)
    instance.include_router(live_router)

    instance.get("/health")(_health_check)
    install_error_handlers(instance)

    return instance


# Instance par défaut (utilisée par les tests)
app = create_fastapi_app()


def init_web(
    *,
    health: HealthRegistry,
    handle_message: Any,  # noqa: ANN401
    stream_message: Any = None,  # noqa: ANN401
    jwt_secret: str = "",
    auth_service: object | None = None,
    identity_service: object | None = None,
    billing_service: object | None = None,
    entitlements_service: object | None = None,
    follow_service: object | None = None,
    notif_settings_service: object | None = None,
    conversation_service: object | None = None,
    sse_port: object | None = None,
    leagues_repo: object | None = None,
    standings_repo: object | None = None,
    teams_repo: object | None = None,
    players_repo: object | None = None,
    fixtures_repo: object | None = None,
    live_repo: object | None = None,
    squad_repo: object | None = None,
    admin_token: str = "",
    admin_service: object | None = None,
    collector: object | None = None,
    apifootball: object | None = None,
) -> None:
    """Câble les dépendances depuis le conteneur."""
    global _health_registry  # noqa: PLW0603
    _health_registry = health

    init_dependencies(
        jwt_secret=jwt_secret,
        auth_service=auth_service,
        identity_service=identity_service,
    )
    init_chat_routes(handle_message, stream_message)
    init_live_routes(sse_port)
    init_catalog_routes(
        leagues=leagues_repo,
        standings=standings_repo,
        teams=teams_repo,
        players=players_repo,
        fixtures=fixtures_repo,
        live=live_repo,
        squad=squad_repo,
    )
    if auth_service is not None:
        init_auth_routes(auth_service)
    if identity_service is not None:
        init_account_routes(identity_service)
    if billing_service is not None:
        init_billing_routes(billing_service, entitlements_service)
    if follow_service is not None:
        init_follows_routes(follow_service)
    if notif_settings_service is not None:
        init_settings_routes(notif_settings_service, conversation_service)
    init_admin_routes(
        admin_token=admin_token,
        jwt_secret=jwt_secret,
        health_registry=health,
        collector=collector,
        apifootball=apifootball,
        admin_service=admin_service,
        entitlements_service=entitlements_service,
    )
