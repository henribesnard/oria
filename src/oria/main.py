"""Composition root — construit le conteneur, démarre les modules, lance l'app."""

from __future__ import annotations

import asyncio
import contextlib
import logging
from functools import partial

from oria.app.admin.service import AdminService
from oria.app.auth.service import AuthService
from oria.app.billing.service import SubscriptionService
from oria.app.conversations.service import ConversationService
from oria.app.entitlements.service import Entitlements
from oria.app.identity.service import IdentityService
from oria.app.preferences.service import FollowService, NotificationSettingsService
from oria.config import Settings
from oria.container import Container
from oria.core.orchestrator import Orchestrator
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.streaming import stream_message
from oria.core.synthesis import Synthesis
from oria.domain.fixtures import FixturesRepository
from oria.domain.injuries import InjuriesRepository
from oria.domain.lineups import LineupsRepository
from oria.domain.live import LiveRepository
from oria.domain.odds import OddsRepository
from oria.domain.players import PlayersRepository
from oria.domain.standings import StandingsRepository
from oria.domain.teams import TeamsRepository
from oria.ingestion.scheduler import IngestionScheduler
from oria.kernel.logging import setup_logging
from oria.liveengine.engine import LiveEngine
from oria.notifications.dispatcher import NotificationDispatcher
from oria.notifications.outbound_email import EmailOutboundPort
from oria.notifications.outbound_sse import SSEOutboundPort
from oria.providers.apifootball.client import ApiFootballClient
from oria.providers.llm.deepseek import DeepSeekProvider
from oria.providers.mail import MailProvider
from oria.providers.weather import WeatherProvider
from oria.storage.cache import Cache
from oria.storage.db import Database
from oria.storage.userstore import UserStore
from oria.tools.football import register_football_tools
from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


def build_container(settings: Settings) -> tuple[Container, Pipeline]:
    """Instancie et câble tous les modules."""
    container = Container(settings=settings)

    # --- Modules requis ---
    db = Database(db_path=settings.db_path)
    cache = Cache(db=db)
    synthesis = Synthesis()

    container.add(db)
    container.add(cache)
    container.add(synthesis)

    # --- Modules optionnels : providers ---
    llm: DeepSeekProvider | None = None
    if settings.enable_llm:
        llm = DeepSeekProvider(
            api_key=settings.deepseek_api_key,
            model_fast=settings.llm_model_fast,
            model_deep=settings.llm_model_deep,
        )
        container.add(llm)

    apifootball: ApiFootballClient | None = None
    if settings.apifootball_key:
        apifootball = ApiFootballClient(settings=settings)
        container.add(apifootball)

    if settings.enable_weather and settings.weather_api_key:
        container.add(WeatherProvider(api_key=settings.weather_api_key))

    # --- Identity (M8) ---
    identity_service = IdentityService(db=db)
    container.add(identity_service)

    # --- Auth (M9) ---
    mail = MailProvider(
        smtp_host=settings.mail_smtp_host,
        smtp_port=settings.mail_smtp_port,
        mail_from=settings.mail_from,
    )
    container.add(mail)

    auth_service = AuthService(
        db=db, identity=identity_service, mail=mail, settings=settings,
    )
    container.add(auth_service)

    # --- Billing & Entitlements (M10) ---
    billing_service = SubscriptionService(db=db, settings=settings)
    container.add(billing_service)

    entitlements = Entitlements(db=db, billing=billing_service, settings=settings)
    container.add(entitlements)

    # --- Preferences & Conversations (M11) ---
    follow_service = FollowService(db=db)
    container.add(follow_service)

    notif_settings_service = NotificationSettingsService(db=db)
    container.add(notif_settings_service)

    conversation_service = ConversationService(db=db)
    container.add(conversation_service)

    # --- Userstore ---
    userstore = UserStore(db=db)
    container.add(userstore)

    # --- Repositories (client injecté si disponible) ---
    fixtures = FixturesRepository(cache=cache, client=apifootball)
    standings = StandingsRepository(cache=cache, client=apifootball)
    teams = TeamsRepository(cache=cache, client=apifootball)
    players = PlayersRepository(cache=cache, client=apifootball)
    injuries = InjuriesRepository(cache=cache, client=apifootball)
    lineups = LineupsRepository(cache=cache, client=apifootball)
    odds = OddsRepository(cache=cache, client=apifootball)
    live = LiveRepository(cache=cache, client=apifootball)

    container.add(fixtures)
    container.add(standings)
    container.add(teams)
    container.add(players)
    container.add(injuries)
    container.add(lineups)
    container.add(odds)
    container.add(live)

    # --- Tools ---
    tool_registry = ToolRegistry()
    register_football_tools(
        tool_registry,
        fixtures=fixtures,
        standings=standings,
        teams=teams,
        players=players,
        injuries=injuries,
        lineups=lineups,
        odds=odds,
        live=live,
    )
    container.add(tool_registry)

    # --- Core (M12) ---
    prerouter = PreRouter(tools=tool_registry)
    orchestrator = Orchestrator(llm=llm, tools=tool_registry)
    pipeline = Pipeline(
        synthesis=synthesis,
        prerouter=prerouter,
        orchestrator=orchestrator,
        entitlements=entitlements,
        conversations=conversation_service,
    )

    container.add(prerouter)
    container.add(orchestrator)
    container.add(pipeline)

    # --- Ingestion & Live (M13) ---
    ingestion = IngestionScheduler(
        follow_service=follow_service,
        standings=standings,
        fixtures=fixtures,
        lineups=lineups,
        event_bus=container.bus,
    )
    container.add(ingestion)

    live_engine = LiveEngine(
        live_repo=live,
        follow_service=follow_service,
        event_bus=container.bus,
    )
    container.add(live_engine)

    # --- Notifications (M14) ---
    sse_port = SSEOutboundPort()
    email_port = EmailOutboundPort(mail=mail)
    notif_dispatcher = NotificationDispatcher(
        event_bus=container.bus,
        follow_service=follow_service,
        notif_settings=notif_settings_service,
        entitlements=entitlements,
        email_port=email_port,
        sse_port=sse_port,
    )
    container.add(notif_dispatcher)
    container._sse_port = sse_port  # type: ignore[attr-defined]

    # --- Admin (M16) ---
    admin_service = AdminService(
        identity=identity_service,
        auth=auth_service,
        bootstrap_token=settings.admin_bootstrap_token,
    )
    container.add(admin_service)
    container._admin_service = admin_service  # type: ignore[attr-defined]

    # Streaming callable pour le web adapter
    stream_fn = partial(
        stream_message,
        synthesis=synthesis,
        prerouter=prerouter,
        orchestrator=orchestrator,
        entitlements=entitlements,
        conversations=conversation_service,
    )
    container._stream_fn = stream_fn  # type: ignore[attr-defined]

    return container, pipeline


async def run_console(settings: Settings) -> None:
    """Démarre Oria en mode console."""
    container, pipeline = build_container(settings)

    await container.start_all()
    logger.info("Oria started (console mode)")

    from oria.adapters.console import ConsoleAdapter

    console = ConsoleAdapter(handle_message=pipeline.handle_message)
    try:
        await console.run()
    finally:
        await container.stop_all()


def main() -> None:
    """Point d'entrée CLI : python -m oria.main"""
    settings = Settings()
    setup_logging(level=settings.log_level)

    logger.info("Oria booting", extra={"log_level": settings.log_level})

    with contextlib.suppress(KeyboardInterrupt):
        asyncio.run(run_console(settings))


if __name__ == "__main__":
    main()
