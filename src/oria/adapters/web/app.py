"""Adaptateur web FastAPI — routes publiques, auth, chat, admin, catalog, live."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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

app = FastAPI(title="Oria", version="0.1.0")

# Routers
app.include_router(admin_router)
app.include_router(auth_router)
app.include_router(account_router)
app.include_router(billing_router)
app.include_router(follows_router)
app.include_router(settings_router)
app.include_router(chat_router)
app.include_router(catalog_router)
app.include_router(live_router)

# Error handlers
install_error_handlers(app)

# Sera injecté au démarrage par main.py
_health_registry: HealthRegistry | None = None


def init_web(
    *,
    health: HealthRegistry,
    handle_message: Any,  # noqa: ANN401
    stream_message: Any = None,  # noqa: ANN401
    jwt_secret: str = "",
    cors_origins: str = "*",
    auth_service: object | None = None,
    identity_service: object | None = None,
    billing_service: object | None = None,
    entitlements_service: object | None = None,
    follow_service: object | None = None,
    notif_settings_service: object | None = None,
    conversation_service: object | None = None,
    sse_port: object | None = None,
    standings_repo: object | None = None,
    teams_repo: object | None = None,
    players_repo: object | None = None,
    fixtures_repo: object | None = None,
    admin_token: str = "",
    admin_service: object | None = None,
    collector: object | None = None,
    apifootball: object | None = None,
) -> None:
    """Câble les dépendances depuis le conteneur."""
    global _health_registry  # noqa: PLW0603
    _health_registry = health

    # CORS
    origins = [o.strip() for o in cors_origins.split(",") if o.strip()]
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    init_dependencies(
        jwt_secret=jwt_secret,
        auth_service=auth_service,
        identity_service=identity_service,
    )
    init_chat_routes(handle_message, stream_message)
    init_live_routes(sse_port)
    init_catalog_routes(
        standings=standings_repo,
        teams=teams_repo,
        players=players_repo,
        fixtures=fixtures_repo,
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
        health_registry=health,
        collector=collector,
        apifootball=apifootball,
        admin_service=admin_service,
    )


# -- Endpoints --


@app.get("/health")
async def health_check() -> dict[str, Any]:
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
