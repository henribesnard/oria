"""Fixtures partagées pour la campagne de validation."""

from __future__ import annotations

import contextlib
import logging
from typing import TYPE_CHECKING, Any

import pytest

from oria.config import Settings
from oria.core.orchestrator import Orchestrator
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.synthesis import Synthesis
from oria.domain.fixtures import FixturesRepository
from oria.domain.injuries import InjuriesRepository
from oria.domain.lineups import LineupsRepository
from oria.domain.live import LiveRepository
from oria.domain.match_events import EventsRepository
from oria.domain.match_statistics import StatisticsRepository
from oria.domain.odds import OddsRepository
from oria.domain.players import PlayersRepository
from oria.domain.standings import StandingsRepository
from oria.domain.teams import TeamsRepository
from oria.providers.apifootball.client import ApiFootballClient
from oria.storage.cache import Cache
from oria.storage.db import Database
from oria.tools.football import register_football_tools
from oria.tools.registry import ToolRegistry
from tests.campaign.harness import Latencies, Probe
from tests.campaign.recorder import Recorder, install_recorder
from tests.campaign.report import CampaignMetrics, create_run_dir
from tests.campaign.seasons import resolve_current_season

if TYPE_CHECKING:
    from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
logger = logging.getLogger("campaign")

# ---------------------------------------------------------------------------
# Charger les settings
# ---------------------------------------------------------------------------

try:
    _SETTINGS = Settings(
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        db_path=":memory:",
    )
    API_CONFIGURED = bool(_SETTINGS.apifootball_key)
except Exception:
    API_CONFIGURED = False
    _SETTINGS = None  # type: ignore[assignment]


# ---------------------------------------------------------------------------
# IDs connus
# ---------------------------------------------------------------------------

LIGUE_1_ID = 61
PREMIER_LEAGUE_ID = 39
LA_LIGA_ID = 140
SERIE_A_ID = 135
BUNDESLIGA_ID = 78
ALL_LEAGUE_IDS = [LIGUE_1_ID, PREMIER_LEAGUE_ID, LA_LIGA_ID, SERIE_A_ID, BUNDESLIGA_ID]

PSG_ID = 85
OM_ID = 81
LYON_ID = 80


# ---------------------------------------------------------------------------
# Fixtures : session-scoped pour partager entre phases
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def run_dir() -> Path:
    return create_run_dir()


@pytest.fixture(scope="session")
def recorder() -> Recorder:
    return Recorder()


@pytest.fixture(scope="session")
def latencies() -> Latencies:
    return Latencies()


@pytest.fixture(scope="session")
def campaign_metrics() -> CampaignMetrics:
    return CampaignMetrics()


@pytest.fixture(scope="session")
async def campaign_env(
    recorder: Recorder,
) -> tuple[
    Pipeline,
    ApiFootballClient,
    Database,
    Cache,
    ToolRegistry,
    dict[str, Any],
    int,
]:
    """Boot le pipeline complet avec la vraie API Football.

    Retourne:
        (pipeline, client, db, cache, tool_registry, repos_dict, season)
    """
    if not API_CONFIGURED:
        pytest.skip("APIFOOTBALL_KEY not set")

    assert _SETTINGS is not None
    settings = Settings(
        apifootball_key=_SETTINGS.apifootball_key,
        deepseek_api_key=_SETTINGS.deepseek_api_key or "",
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        db_path=":memory:",
        apifootball_base_url="https://v3.football.api-sports.io",
        apifootball_auth_mode="direct",
        apifootball_daily_budget=7500,
        apifootball_rate_per_min=300,
        log_level="INFO",
    )

    # Boot modules
    db = Database(db_path=":memory:")
    await db.start()

    cache = Cache(db=db)
    await cache.start()

    client = ApiFootballClient(settings=settings)
    await client.start()

    # Installer le recorder (monkeypatch)
    install_recorder(client, recorder)

    # Résoudre la saison dynamiquement
    season = await resolve_current_season(client, LIGUE_1_ID)
    logger.info("Saison courante résolue : %d", season)

    # Repositories
    fixtures = FixturesRepository(cache=cache, client=client)
    standings = StandingsRepository(cache=cache, client=client)
    teams_repo = TeamsRepository(cache=cache, client=client)
    players = PlayersRepository(cache=cache, client=client)
    injuries = InjuriesRepository(cache=cache, client=client)
    lineups = LineupsRepository(cache=cache, client=client)
    odds = OddsRepository(cache=cache, client=client)
    live = LiveRepository(cache=cache, client=client)
    match_events = EventsRepository(cache=cache, client=client)
    match_statistics = StatisticsRepository(cache=cache, client=client)

    repos = {
        "fixtures": fixtures,
        "standings": standings,
        "teams": teams_repo,
        "players": players,
        "injuries": injuries,
        "lineups": lineups,
        "odds": odds,
        "live": live,
    }

    # Tools
    registry = ToolRegistry()
    register_football_tools(
        registry,
        fixtures=fixtures,
        standings=standings,
        teams=teams_repo,
        players=players,
        injuries=injuries,
        lineups=lineups,
        odds=odds,
        live=live,
        events=match_events,
        statistics=match_statistics,
    )

    # Pipeline
    synthesis = Synthesis()
    prerouter = PreRouter(tools=registry)
    orchestrator = Orchestrator(llm=None, tools=registry)
    pipeline = Pipeline(
        synthesis=synthesis,
        prerouter=prerouter,
        orchestrator=orchestrator,
    )

    yield pipeline, client, db, cache, registry, repos, season

    # Shutdown
    with contextlib.suppress(RuntimeError):
        await client.stop()
    with contextlib.suppress(RuntimeError):
        await db.stop()


@pytest.fixture(scope="session")
def probe(
    campaign_env: tuple[Pipeline, ApiFootballClient, Database, Cache, ToolRegistry, dict, int],
) -> Probe:
    pipeline, client, *_ = campaign_env
    return Probe(pipeline=pipeline, governor=client.governor)


@pytest.fixture(scope="session")
def client(
    campaign_env: tuple[Pipeline, ApiFootballClient, Database, Cache, ToolRegistry, dict, int],
) -> ApiFootballClient:
    return campaign_env[1]


@pytest.fixture(scope="session")
def season(
    campaign_env: tuple[Pipeline, ApiFootballClient, Database, Cache, ToolRegistry, dict, int],
) -> int:
    return campaign_env[6]


@pytest.fixture(scope="session")
def repos(
    campaign_env: tuple[Pipeline, ApiFootballClient, Database, Cache, ToolRegistry, dict, int],
) -> dict[str, Any]:
    return campaign_env[5]
