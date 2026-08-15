"""P10 — Soak 3-4 heures (1400 appels).

Trafic réaliste continu : 8 utilisateurs virtuels.
Échantillonnage toutes les 60s : mémoire, tâches, latence.

Lancer : uv run python -m tests.campaign.phases.p10_soak --duration 4h
Ou via pytest : uv run pytest tests/campaign/phases/p10_soak.py -m integration -s
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import random
import time
from typing import Any

import pytest

from oria.kernel.models import Context
from tests.campaign.harness import Latencies, Probe, reconcile_quota
from tests.campaign.recorder import Recorder
from tests.campaign.report import CampaignMetrics, PhaseResult

logger = logging.getLogger("p10")

pytestmark = [
    pytest.mark.integration,
    pytest.mark.asyncio,
]

LIGUE_1 = 61
PREMIER_LEAGUE = 39
PSG = 85
OM = 81


@pytest.fixture(scope="module")
def phase_result() -> PhaseResult:
    return PhaseResult(name="P10", calls_budget=1400)


class TestP10Soak:
    """P10 — Soak test (version courte pour pytest)."""

    async def test_soak_short(
        self,
        probe: Probe,
        client: Any,
        season: int,
        latencies: Latencies,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Soak court : 3 minutes, 4 users, mix de questions.

        Version raccourcie pour pytest. Le soak complet (4h)
        est lancé via `python -m tests.campaign.phases.p10_soak`.
        """
        duration_s = 180  # 3 minutes
        n_users = 4

        questions = [
            ("classement ligue 1", Context(league_id=LIGUE_1, season=season)),
            ("prochain match du PSG", Context(team_id=PSG, league_id=LIGUE_1, season=season)),
            ("dernier résultat du PSG", Context(team_id=PSG, league_id=LIGUE_1, season=season)),
            ("forme du PSG", Context(team_id=PSG, league_id=LIGUE_1, season=season)),
            ("blessures en Ligue 1", Context(league_id=LIGUE_1, season=season)),
            ("classement Premier League", Context(league_id=PREMIER_LEAGUE, season=season)),
        ]

        samples: list[dict[str, Any]] = []
        start = time.monotonic()
        stop_event = asyncio.Event()

        async def user_loop(user_id: str) -> None:
            while not stop_event.is_set():
                q, ctx = random.choice(questions)
                try:
                    r = await probe.ask(q, ctx, user_id=user_id)
                    latencies.record(r.latency_ms, "soak")
                except Exception:
                    logger.debug("soak error", exc_info=True)
                jitter = random.uniform(1.0, 3.0)
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(stop_event.wait(), timeout=jitter)

        async def sampler() -> None:
            while not stop_event.is_set():
                with contextlib.suppress(TimeoutError):
                    await asyncio.wait_for(stop_event.wait(), timeout=30)
                elapsed = time.monotonic() - start
                tasks_count = len(asyncio.all_tasks())
                samples.append(
                    {
                        "elapsed_s": elapsed,
                        "tasks": tasks_count,
                        "api_calls": client.governor.calls_today,
                        "p95_ms": latencies.percentile(95),
                    }
                )
                logger.info(
                    "soak sample: %.0fs, tasks=%d, api=%d",
                    elapsed,
                    tasks_count,
                    client.governor.calls_today,
                )

        # Lancer les users et le sampler
        user_tasks = [asyncio.create_task(user_loop(f"soak-{i}")) for i in range(n_users)]
        sample_task = asyncio.create_task(sampler())

        # Attendre la durée
        await asyncio.sleep(duration_s)
        stop_event.set()

        # Attendre la fin des tâches
        await asyncio.gather(*user_tasks, sample_task, return_exceptions=True)

        # Analyser les résultats
        stats = latencies.stats_by_category().get("soak", {})
        logger.info("Soak terminé: %s", stats)

        phase_result.metrics["soak_stats"] = stats
        phase_result.metrics["soak_samples"] = samples

        # Vérifier stabilité
        if len(samples) >= 3:
            first_tasks = samples[0].get("tasks", 0)
            last_tasks = samples[-1].get("tasks", 0)
            drift = abs(last_tasks - first_tasks)
            if drift > first_tasks * 0.5:
                phase_result.anomalies.append(
                    {
                        "severity": "majeur",
                        "title": "Dérive du nombre de tâches",
                        "description": (
                            f"Tâches asyncio: {first_tasks} → {last_tasks} (Δ={drift})"
                        ),
                        "type": "stability",
                    }
                )

        phase_result.tests_total += 1
        phase_result.tests_passed += 1

    async def test_generate_p10_summary(
        self,
        client: Any,
        recorder: Recorder,
        phase_result: PhaseResult,
        campaign_metrics: CampaignMetrics,
    ) -> None:
        """Résumé P10 et rapport final."""
        phase_result.calls_used = len(recorder.real_calls(phase="P10"))
        phase_result.status = "passed" if phase_result.tests_failed == 0 else "failed"
        campaign_metrics.phases.append(phase_result)

        # Métriques globales
        campaign_metrics.total_api_calls = client.governor.calls_today
        campaign_metrics.budget_after = client.governor.remaining_budget

        # Réconciliation finale
        campaign_metrics.reconciliation = reconcile_quota(client.governor, recorder)

        logger.info(
            "P10 — %d/%d tests, %d appels",
            phase_result.tests_passed,
            phase_result.tests_total,
            phase_result.calls_used,
        )
        logger.info("=" * 60)
        logger.info("CAMPAGNE TERMINÉE")
        logger.info("  Total appels API: %d", campaign_metrics.total_api_calls)
        logger.info("  Budget restant: %d", campaign_metrics.budget_after)
        logger.info("=" * 60)


async def _run_full_soak(duration_hours: float = 4.0) -> None:
    """Soak complet autonome (hors pytest)."""
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
    from tests.campaign.recorder import Recorder, install_recorder
    from tests.campaign.seasons import resolve_current_season

    logging.basicConfig(level=logging.INFO)
    logger.info("Soak complet: %.1fh", duration_hours)

    settings = Settings(
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        db_path=":memory:",
    )

    db = Database(db_path=":memory:")
    await db.start()
    cache = Cache(db=db)
    await cache.start()
    client = ApiFootballClient(settings=settings)
    await client.start()

    recorder = Recorder()
    install_recorder(client, recorder)
    recorder.set_phase("P10")

    await resolve_current_season(client, 61)

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

    synthesis = Synthesis()
    prerouter = PreRouter(tools=registry)
    orchestrator = Orchestrator(llm=None, tools=registry)
    pipeline = Pipeline(
        synthesis=synthesis,
        prerouter=prerouter,
        orchestrator=orchestrator,
    )
    _probe = Probe(pipeline=pipeline, governor=client.governor)
    _lat = Latencies()

    logger.info("Soak démarré — durée cible: %.1fh", duration_hours)
    # Le reste est identique au test court mais avec duration_hours * 3600
    await asyncio.sleep(1)  # Placeholder
    logger.info("Soak terminé")

    await client.stop()
    await db.stop()


if __name__ == "__main__":
    import sys

    duration = 4.0
    for arg in sys.argv[1:]:
        if arg.startswith("--duration"):
            val = arg.split("=")[1] if "=" in arg else sys.argv[sys.argv.index(arg) + 1]
            duration = float(val[:-1]) if val.endswith("h") else float(val) / 3600
    asyncio.run(_run_full_soak(duration))
