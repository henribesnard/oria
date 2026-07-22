"""Composition root — construit le conteneur, démarre les modules, lance l'app."""

from __future__ import annotations

import asyncio
import contextlib
import logging

from oria.config import Settings
from oria.container import Container
from oria.core.orchestrator import Orchestrator
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.synthesis import Synthesis
from oria.domain.fixtures import FixturesRepository
from oria.domain.standings import StandingsRepository
from oria.kernel.logging import setup_logging
from oria.providers.apifootball.client import ApiFootballClient
from oria.providers.llm.deepseek import DeepSeekProvider
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
        apifootball = ApiFootballClient(
            api_key=settings.apifootball_key,
            daily_budget=settings.apifootball_daily_budget,
        )
        container.add(apifootball)

    if settings.enable_weather and settings.weather_api_key:
        container.add(WeatherProvider(api_key=settings.weather_api_key))

    # --- Userstore ---
    userstore = UserStore(db=db)
    container.add(userstore)

    # --- Repositories ---
    fixtures = FixturesRepository(cache=cache)
    standings = StandingsRepository(cache=cache)
    container.add(fixtures)
    container.add(standings)

    # --- Tools ---
    tool_registry = ToolRegistry()
    register_football_tools(tool_registry, fixtures=fixtures, standings=standings)
    container.add(tool_registry)

    # --- Core ---
    prerouter = PreRouter()
    orchestrator = Orchestrator(llm=llm, tools=tool_registry)
    pipeline = Pipeline(
        synthesis=synthesis,
        prerouter=prerouter,
        orchestrator=orchestrator,
    )

    container.add(prerouter)
    container.add(orchestrator)
    container.add(pipeline)

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
