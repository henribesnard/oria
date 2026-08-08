"""Campagne de tests E2E exhaustive — passe des questions reelles dans le pipeline.

Cette campagne :
1. Boot le pipeline complet avec la vraie API Football (pas de mock)
2. Envoie une liste exhaustive de questions couvrant TOUS les types supportes
3. Rejoue les memes questions sous des formulations differentes (test cache)
4. Produit un rapport complet a la fin

Lancer : pytest tests/test_campaign.py -m integration -s -v --tb=short
Necessite APIFOOTBALL_KEY dans .env
Budget estime : ~80-120 appels API (sur 7500/jour)
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

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
from oria.kernel.models import Context, IncomingRequest, Response
from oria.providers.apifootball.client import ApiFootballClient
from oria.storage.cache import Cache
from oria.storage.db import Database
from oria.tools.football import register_football_tools
from oria.tools.registry import ToolRegistry

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

logging.basicConfig(level=logging.INFO, format="%(name)s | %(message)s")
logger = logging.getLogger("campaign")

# Charger la cle API via Settings (lit .env)
try:
    _SETTINGS = Settings(
        deepseek_api_key="",
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        db_path=":memory:",
        apifootball_daily_budget=7500,
        apifootball_rate_per_min=300,
    )
    _HAS_AF = bool(_SETTINGS.apifootball_key)
except Exception:
    _HAS_AF = False

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not _HAS_AF, reason="APIFOOTBALL_KEY not set"),
]

# IDs connus
LIGUE_1_ID = 61
PREMIER_LEAGUE_ID = 39
LA_LIGA_ID = 140
SERIE_A_ID = 135
BUNDESLIGA_ID = 78
PSG_ID = 85
OM_ID = 81
LYON_ID = 80
REAL_MADRID_ID = 541
BARCELONA_ID = 529
MANCHESTER_CITY_ID = 50
SEASON = 2024


# ---------------------------------------------------------------------------
# Data classes pour le rapport
# ---------------------------------------------------------------------------


@dataclass
class QuestionResult:
    """Resultat d'une question passee dans le pipeline."""
    category: str
    question: str
    context: Context
    route: str  # "prerouter" | "orchestrator" | "fallback"
    response_text: str
    has_attachments: bool
    attachment_kinds: list[str]
    degraded: bool
    latency_ms: float
    success: bool
    error: str = ""
    api_calls_before: int = 0
    api_calls_after: int = 0


@dataclass
class CacheTestResult:
    """Resultat d'un test de cache (question posee 2 fois)."""
    category: str
    question_v1: str
    question_v2: str
    latency_v1_ms: float
    latency_v2_ms: float
    speedup_ratio: float
    api_calls_v1: int
    api_calls_v2: int
    cache_hit: bool  # True si v2 n'a pas consomme d'appel API supplementaire


@dataclass
class CampaignReport:
    """Rapport complet de la campagne."""
    question_results: list[QuestionResult] = field(default_factory=list)
    cache_results: list[CacheTestResult] = field(default_factory=list)
    total_api_calls: int = 0
    total_duration_ms: float = 0
    budget_before: int = 0
    budget_after: int = 0


# ---------------------------------------------------------------------------
# Questions exhaustives par categorie
# ---------------------------------------------------------------------------

# Chaque entree : (categorie, question, context)
QUESTIONS: list[tuple[str, str, Context]] = [
    # =====================================================================
    # 1. SALUTATIONS (prerouter, pas d'appel API)
    # =====================================================================
    ("salutation", "Bonjour", Context()),
    ("salutation", "Salut !", Context()),
    ("salutation", "Hello", Context()),
    ("salutation", "Hey", Context()),
    ("salutation", "Coucou", Context()),

    # =====================================================================
    # 2. AIDE (prerouter, pas d'appel API)
    # =====================================================================
    ("aide", "aide", Context()),
    ("aide", "help", Context()),

    # =====================================================================
    # 3. CLASSEMENTS (prerouter avec outils, appels API)
    # =====================================================================
    ("classement", "classement ligue 1",
     Context(league_id=LIGUE_1_ID, season=SEASON)),
    ("classement", "standings Premier League",
     Context(league_id=PREMIER_LEAGUE_ID, season=SEASON)),
    ("classement", "classement La Liga",
     Context(league_id=LA_LIGA_ID, season=SEASON)),
    ("classement", "classement Serie A",
     Context(league_id=SERIE_A_ID, season=SEASON)),
    ("classement", "classement Bundesliga",
     Context(league_id=BUNDESLIGA_ID, season=SEASON)),

    # =====================================================================
    # 4. PROCHAIN MATCH (prerouter avec outils)
    # =====================================================================
    ("prochain_match", "prochain match du PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),
    ("prochain_match", "next match Real Madrid",
     Context(team_id=REAL_MADRID_ID, league_id=LA_LIGA_ID, season=SEASON)),
    ("prochain_match", "prochain match de l'OM",
     Context(team_id=OM_ID, league_id=LIGUE_1_ID, season=SEASON)),

    # =====================================================================
    # 5. DERNIER RESULTAT (prerouter avec outils)
    # =====================================================================
    ("dernier_resultat", "dernier resultat du PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),
    ("dernier_resultat", "score PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),
    ("dernier_resultat", "last result Barcelona",
     Context(team_id=BARCELONA_ID, league_id=LA_LIGA_ID, season=SEASON)),

    # =====================================================================
    # 6. FORME (prerouter avec outils)
    # =====================================================================
    ("forme", "forme du PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),
    ("forme", "form Manchester City",
     Context(team_id=MANCHESTER_CITY_ID, league_id=PREMIER_LEAGUE_ID, season=SEASON)),

    # =====================================================================
    # 7. CALENDRIER (prerouter avec outils)
    # =====================================================================
    ("calendrier", "calendrier PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),
    ("calendrier", "programme de l'OL",
     Context(team_id=LYON_ID, league_id=LIGUE_1_ID, season=SEASON)),
    ("calendrier", "schedule Real Madrid",
     Context(team_id=REAL_MADRID_ID, league_id=LA_LIGA_ID, season=SEASON)),

    # =====================================================================
    # 8. MATCHS PAR LIGUE (via outils, pas de pattern prerouter)
    # =====================================================================
    ("matchs_ligue", "matchs de Ligue 1 aujourd'hui",
     Context(league_id=LIGUE_1_ID, season=SEASON)),
    ("matchs_ligue", "les matchs de Premier League",
     Context(league_id=PREMIER_LEAGUE_ID, season=SEASON)),

    # =====================================================================
    # 9. INFOS EQUIPE (pas de pattern prerouter direct)
    # =====================================================================
    ("info_equipe", "informations sur le PSG",
     Context(team_id=PSG_ID)),
    ("info_equipe", "qui est le Real Madrid ?",
     Context(team_id=REAL_MADRID_ID)),

    # =====================================================================
    # 10. BLESSURES (pas de pattern prerouter)
    # =====================================================================
    ("blessures", "blessures en Ligue 1",
     Context(league_id=LIGUE_1_ID, season=SEASON)),
    ("blessures", "joueurs blesses au PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),

    # =====================================================================
    # 11. JOUEURS / STATS (pas de pattern prerouter)
    # =====================================================================
    ("joueurs", "joueurs du PSG cette saison",
     Context(team_id=PSG_ID, season=SEASON)),
    ("joueurs", "stats des joueurs de l'OM",
     Context(team_id=OM_ID, season=SEASON)),

    # =====================================================================
    # 12. SCORES EN DIRECT (pas de pattern prerouter)
    # =====================================================================
    ("live", "scores en direct",
     Context()),
    ("live", "matchs en cours en Ligue 1",
     Context(league_id=LIGUE_1_ID)),

    # =====================================================================
    # 13. COTES (pas de pattern prerouter)
    # =====================================================================
    ("cotes", "cotes Ligue 1",
     Context(league_id=LIGUE_1_ID, season=SEASON)),

    # =====================================================================
    # 14. QUESTIONS COMPLEXES / ANALYTIQUES (orchestrateur LLM)
    # =====================================================================
    ("analytique", "qui va gagner le championnat de Ligue 1 ?",
     Context(league_id=LIGUE_1_ID, season=SEASON)),
    ("analytique", "compare le PSG et l'OM cette saison",
     Context(league_id=LIGUE_1_ID, season=SEASON)),

    # =====================================================================
    # 15. QUESTIONS HORS SCOPE
    # =====================================================================
    ("hors_scope", "quelle est la meteo aujourd'hui ?", Context()),
    ("hors_scope", "raconte-moi une blague", Context()),

    # =====================================================================
    # 16. QUESTIONS EDGE CASES
    # =====================================================================
    ("edge_case", "", Context()),  # Question vide
    ("edge_case", "x", Context()),  # Question ultra courte
    ("edge_case", "a" * 500, Context()),  # Question tres longue
    ("edge_case", "classement",
     Context(league_id=99999, season=SEASON)),  # Ligue inexistante
]

# Questions reformulees pour tester le cache
# (categorie, question_v1, question_v2, context)
CACHE_QUESTIONS: list[tuple[str, str, str, Context]] = [
    ("cache_classement",
     "classement ligue 1",
     "classement Ligue 1 saison en cours",
     Context(league_id=LIGUE_1_ID, season=SEASON)),

    ("cache_prochain_match",
     "prochain match du PSG",
     "next match PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),

    ("cache_dernier_resultat",
     "dernier resultat du PSG",
     "score du PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),

    ("cache_forme",
     "forme du PSG",
     "form PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),

    ("cache_calendrier",
     "calendrier PSG",
     "schedule du PSG",
     Context(team_id=PSG_ID, league_id=LIGUE_1_ID, season=SEASON)),

    ("cache_classement_pl",
     "standings Premier League",
     "classement PL",
     Context(league_id=PREMIER_LEAGUE_ID, season=SEASON)),
]


# ---------------------------------------------------------------------------
# Fixture : pipeline complet avec vraie API
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
async def campaign_env() -> tuple[Pipeline, ApiFootballClient, CampaignReport]:
    """Boot le pipeline complet avec la vraie API Football."""
    settings = Settings(
        apifootball_key=_SETTINGS.apifootball_key,
        deepseek_api_key="",
        enable_llm=False,  # Pas de LLM pour isoler le pipeline des couts DeepSeek
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        db_path=":memory:",
        apifootball_base_url="https://v3.football.api-sports.io",
        apifootball_auth_mode="direct",
        apifootball_daily_budget=7500,
        apifootball_rate_per_min=300,
        log_level="DEBUG",
    )

    # Boot tous les modules
    db = Database(db_path=":memory:")
    await db.start()

    cache = Cache(db=db)
    await cache.start()

    client = ApiFootballClient(settings=settings)
    await client.start()

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
    orchestrator = Orchestrator(llm=None, tools=registry)  # Pas de LLM
    pipeline = Pipeline(
        synthesis=synthesis,
        prerouter=prerouter,
        orchestrator=orchestrator,
    )

    report = CampaignReport(budget_before=client.governor.remaining_budget)

    yield pipeline, client, report

    report.budget_after = client.governor.remaining_budget
    report.total_api_calls = client.governor.calls_today

    # Shutdown (ignore event loop closing errors on Windows)
    try:
        await client.stop()
    except RuntimeError:
        pass
    try:
        await db.stop()
    except RuntimeError:
        pass


# ---------------------------------------------------------------------------
# Helper : envoyer une question et mesurer
# ---------------------------------------------------------------------------


async def _ask(
    pipeline: Pipeline,
    client: ApiFootballClient,
    question: str,
    context: Context,
) -> tuple[Response, float, int, int]:
    """Envoie une question, retourne (response, latency_ms, calls_before, calls_after)."""
    req = IncomingRequest(
        user_id="campaign-tester",
        text=question,
        context=context,
        locale="fr",
    )
    calls_before = client.governor.calls_today
    t0 = time.perf_counter()
    resp = await pipeline.handle_message(req)
    latency = (time.perf_counter() - t0) * 1000
    calls_after = client.governor.calls_today
    return resp, latency, calls_before, calls_after


def _detect_route(resp: Response, question: str) -> str:
    """Detecte quelle route a ete prise d'apres la reponse."""
    text = resp.text.lower()
    if "salut" in text and "oria" in text:
        return "prerouter:salutation"
    if "aider avec" in text and "classements" in text:
        return "prerouter:aide"
    if resp.attachments:
        kinds = [a.kind for a in resp.attachments]
        if "table" in kinds and any("standings" in str(a.data) for a in resp.attachments):
            return "prerouter:classement"
        if "fixture_card" in kinds:
            return "prerouter:fixture"
        if "table" in kinds and any("form" in str(a.data) for a in resp.attachments):
            return "prerouter:forme"
        if "table" in kinds and any("schedule" in str(a.data) for a in resp.attachments):
            return "prerouter:calendrier"
        return "prerouter:outil"
    if "pas pu traiter" in text or "reformuler" in text:
        return "fallback"
    if resp.degraded:
        return "fallback:degrade"
    return "orchestrator"


# ---------------------------------------------------------------------------
# TEST PRINCIPAL : Campagne exhaustive
# ---------------------------------------------------------------------------


class TestCampaign:
    """Campagne de test E2E exhaustive."""

    @pytest.mark.asyncio
    async def test_all_questions(
        self,
        campaign_env: tuple[Pipeline, ApiFootballClient, CampaignReport],
    ) -> None:
        """Passe toutes les questions dans le pipeline et enregistre les resultats."""
        pipeline, client, report = campaign_env

        start_time = time.perf_counter()

        for category, question, context in QUESTIONS:
            logger.info("=" * 60)
            logger.info("QUESTION [%s]: %s", category, question[:80])
            logger.info("CONTEXT: %s", context.model_dump(exclude_none=True))

            try:
                resp, latency, calls_before, calls_after = await _ask(
                    pipeline, client, question, context,
                )
                route = _detect_route(resp, question)
                api_calls = calls_after - calls_before

                result = QuestionResult(
                    category=category,
                    question=question[:100],
                    context=context,
                    route=route,
                    response_text=resp.text[:300],
                    has_attachments=len(resp.attachments) > 0,
                    attachment_kinds=[a.kind for a in resp.attachments],
                    degraded=resp.degraded,
                    latency_ms=latency,
                    success=True,
                    api_calls_before=calls_before,
                    api_calls_after=calls_after,
                )

                logger.info("  ROUTE: %s", route)
                logger.info("  RESPONSE: %s", resp.text[:120])
                logger.info("  ATTACHMENTS: %s", [a.kind for a in resp.attachments])
                logger.info("  DEGRADED: %s", resp.degraded)
                logger.info("  LATENCY: %.0f ms", latency)
                logger.info("  API CALLS: %d", api_calls)

            except Exception as e:
                result = QuestionResult(
                    category=category,
                    question=question[:100],
                    context=context,
                    route="error",
                    response_text="",
                    has_attachments=False,
                    attachment_kinds=[],
                    degraded=True,
                    latency_ms=0,
                    success=False,
                    error=str(e)[:200],
                )
                logger.error("  ERROR: %s", e)

            report.question_results.append(result)

            # Petit delai pour ne pas bombarder l'API
            await asyncio.sleep(0.1)

        report.total_duration_ms = (time.perf_counter() - start_time) * 1000

        # Assertions de base sur la campagne
        successes = [r for r in report.question_results if r.success]
        failures = [r for r in report.question_results if not r.success]

        logger.info("=" * 60)
        logger.info("CAMPAGNE TERMINEE")
        logger.info("  Total: %d questions", len(report.question_results))
        logger.info("  Succes: %d", len(successes))
        logger.info("  Echecs: %d", len(failures))
        logger.info("  Duree totale: %.0f ms", report.total_duration_ms)

        # Au moins 90% de reussite
        assert len(successes) / len(report.question_results) >= 0.90, (
            f"Taux de reussite trop bas: {len(successes)}/{len(report.question_results)}"
        )

    @pytest.mark.asyncio
    async def test_cache_behavior(
        self,
        campaign_env: tuple[Pipeline, ApiFootballClient, CampaignReport],
    ) -> None:
        """Repose les memes questions sous une autre forme pour tester le cache."""
        pipeline, client, report = campaign_env

        for category, q_v1, q_v2, context in CACHE_QUESTIONS:
            logger.info("=" * 60)
            logger.info("CACHE TEST [%s]", category)
            logger.info("  V1: %s", q_v1)
            logger.info("  V2: %s", q_v2)

            # Question V1
            _, lat_v1, calls_b1, calls_a1 = await _ask(pipeline, client, q_v1, context)
            api_v1 = calls_a1 - calls_b1

            # Petit delai
            await asyncio.sleep(0.05)

            # Question V2 (reformulation, meme contexte => devrait toucher le cache)
            _, lat_v2, calls_b2, calls_a2 = await _ask(pipeline, client, q_v2, context)
            api_v2 = calls_a2 - calls_b2

            speedup = lat_v1 / lat_v2 if lat_v2 > 0 else float("inf")
            cache_hit = api_v2 == 0

            cache_result = CacheTestResult(
                category=category,
                question_v1=q_v1,
                question_v2=q_v2,
                latency_v1_ms=lat_v1,
                latency_v2_ms=lat_v2,
                speedup_ratio=speedup,
                api_calls_v1=api_v1,
                api_calls_v2=api_v2,
                cache_hit=cache_hit,
            )
            report.cache_results.append(cache_result)

            logger.info("  V1: %.0f ms, %d API calls", lat_v1, api_v1)
            logger.info("  V2: %.0f ms, %d API calls", lat_v2, api_v2)
            logger.info("  SPEEDUP: %.1fx", speedup)
            logger.info("  CACHE HIT: %s", cache_hit)

            await asyncio.sleep(0.1)

        # Au moins 50% des reformulations doivent toucher le cache
        cache_hits = sum(1 for r in report.cache_results if r.cache_hit)
        total = len(report.cache_results)
        logger.info("Cache hits: %d/%d (%.0f%%)", cache_hits, total,
                     cache_hits / total * 100 if total else 0)

        assert cache_hits / total >= 0.50 if total > 0 else True, (
            f"Trop peu de cache hits: {cache_hits}/{total}"
        )

    @pytest.mark.asyncio
    async def test_generate_report(
        self,
        campaign_env: tuple[Pipeline, ApiFootballClient, CampaignReport],
    ) -> None:
        """Genere le rapport complet de la campagne."""
        _, client, report = campaign_env

        report.budget_after = client.governor.remaining_budget
        report.total_api_calls = client.governor.calls_today

        report_text = _build_report(report)

        # Ecrire le rapport
        report_path = Path(__file__).parent / "campaign_report.txt"
        report_path.write_text(report_text, encoding="utf-8")
        logger.info("Rapport ecrit dans %s", report_path)

        # Aussi en JSON pour traitement automatique
        report_json_path = Path(__file__).parent / "campaign_report.json"
        report_json_path.write_text(
            json.dumps(_report_to_dict(report), indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )
        logger.info("Rapport JSON ecrit dans %s", report_json_path)

        # Afficher le rapport dans la sortie du test
        print("\n" + report_text)

        # Le rapport doit exister
        assert report_path.exists()


# ---------------------------------------------------------------------------
# Generateur de rapport
# ---------------------------------------------------------------------------


def _build_report(report: CampaignReport) -> str:
    """Construit le rapport textuel complet."""
    lines: list[str] = []
    sep = "=" * 80

    lines.append(sep)
    lines.append("  RAPPORT DE CAMPAGNE DE TESTS ORIA — E2E Pipeline")
    lines.append(sep)
    lines.append("")

    # -- Resume global --
    total = len(report.question_results)
    successes = sum(1 for r in report.question_results if r.success)
    failures = total - successes
    prerouter_count = sum(1 for r in report.question_results if "prerouter" in r.route)
    fallback_count = sum(1 for r in report.question_results if "fallback" in r.route)
    error_count = sum(1 for r in report.question_results if r.route == "error")
    degraded_count = sum(1 for r in report.question_results if r.degraded)
    avg_latency = (sum(r.latency_ms for r in report.question_results) / total) if total else 0
    total_api = sum(
        r.api_calls_after - r.api_calls_before
        for r in report.question_results
        if r.success
    )

    lines.append("RESUME GLOBAL")
    lines.append("-" * 40)
    lines.append(f"  Questions testees      : {total}")
    lines.append(f"  Succes                 : {successes} ({successes/total*100:.0f}%)" if total else "")
    lines.append(f"  Echecs                 : {failures}")
    lines.append(f"  Route prerouter        : {prerouter_count}")
    lines.append(f"  Route fallback         : {fallback_count}")
    lines.append(f"  Erreurs                : {error_count}")
    lines.append(f"  Reponses degradees     : {degraded_count}")
    lines.append(f"  Latence moyenne        : {avg_latency:.0f} ms")
    lines.append(f"  Appels API (questions) : {total_api}")
    lines.append(f"  Appels API (total)     : {report.total_api_calls}")
    lines.append(f"  Budget avant campagne  : {report.budget_before}")
    lines.append(f"  Budget apres campagne  : {report.budget_after}")
    lines.append(f"  Duree totale           : {report.total_duration_ms:.0f} ms")
    lines.append("")

    # -- Detail par categorie --
    lines.append(sep)
    lines.append("DETAIL PAR CATEGORIE")
    lines.append(sep)

    categories: dict[str, list[QuestionResult]] = {}
    for r in report.question_results:
        categories.setdefault(r.category, []).append(r)

    for cat, results in categories.items():
        lines.append("")
        lines.append(f"--- {cat.upper()} ({len(results)} questions) ---")
        cat_successes = sum(1 for r in results if r.success)
        cat_avg_lat = sum(r.latency_ms for r in results) / len(results)
        cat_api = sum(r.api_calls_after - r.api_calls_before for r in results if r.success)
        lines.append(f"  Succes: {cat_successes}/{len(results)} | "
                      f"Latence moy: {cat_avg_lat:.0f} ms | "
                      f"Appels API: {cat_api}")

        for r in results:
            status = "OK" if r.success else "FAIL"
            attach = f" [{', '.join(r.attachment_kinds)}]" if r.attachment_kinds else ""
            degrad = " [DEGRADE]" if r.degraded else ""
            api_used = r.api_calls_after - r.api_calls_before
            lines.append(
                f"  [{status}] \"{r.question[:60]}\" "
                f"-> {r.route} | {r.latency_ms:.0f}ms | API:{api_used}{attach}{degrad}"
            )
            if r.response_text:
                # Premiere ligne de la reponse
                first_line = r.response_text.split("\n")[0][:100]
                lines.append(f"         Response: {first_line}")
            if r.error:
                lines.append(f"         Error: {r.error}")

    # -- Tests de cache --
    lines.append("")
    lines.append(sep)
    lines.append("TESTS DE CACHE")
    lines.append(sep)

    if report.cache_results:
        cache_hits = sum(1 for r in report.cache_results if r.cache_hit)
        total_cache = len(report.cache_results)
        lines.append(f"  Cache hits: {cache_hits}/{total_cache} "
                      f"({cache_hits/total_cache*100:.0f}%)")
        lines.append("")

        for r in report.cache_results:
            hit_str = "CACHE HIT" if r.cache_hit else "MISS"
            lines.append(f"  [{r.category}] {hit_str}")
            lines.append(f"    V1: \"{r.question_v1}\" -> {r.latency_v1_ms:.0f}ms, "
                          f"{r.api_calls_v1} API calls")
            lines.append(f"    V2: \"{r.question_v2}\" -> {r.latency_v2_ms:.0f}ms, "
                          f"{r.api_calls_v2} API calls")
            lines.append(f"    Speedup: {r.speedup_ratio:.1f}x")
    else:
        lines.append("  Aucun test de cache execute.")

    # -- Analyse de routage --
    lines.append("")
    lines.append(sep)
    lines.append("ANALYSE DE ROUTAGE")
    lines.append(sep)

    routes: dict[str, int] = {}
    for r in report.question_results:
        routes[r.route] = routes.get(r.route, 0) + 1

    for route, count in sorted(routes.items(), key=lambda x: -x[1]):
        pct = count / total * 100 if total else 0
        lines.append(f"  {route:30s} : {count:3d} ({pct:.0f}%)")

    # -- Latences par route --
    lines.append("")
    lines.append(sep)
    lines.append("LATENCES PAR ROUTE")
    lines.append(sep)

    route_latencies: dict[str, list[float]] = {}
    for r in report.question_results:
        if r.success:
            route_latencies.setdefault(r.route, []).append(r.latency_ms)

    for route, lats in sorted(route_latencies.items()):
        avg = sum(lats) / len(lats)
        mn = min(lats)
        mx = max(lats)
        lines.append(f"  {route:30s} : avg={avg:.0f}ms  min={mn:.0f}ms  max={mx:.0f}ms")

    # -- Bugs decouverts --
    lines.append("")
    lines.append(sep)
    lines.append("BUGS DECOUVERTS")
    lines.append(sep)

    # Detecter les routes prerouter qui tombent en fallback
    prerouter_categories = {"prochain_match", "dernier_resultat", "forme", "calendrier"}
    broken_prerouter: list[QuestionResult] = []
    for r in report.question_results:
        if r.category in prerouter_categories and "fallback" in r.route:
            broken_prerouter.append(r)

    if broken_prerouter:
        lines.append("")
        lines.append("  BUG #1 : PreRouter handlers cassees (next/last non supportes)")
        lines.append("  " + "-" * 60)
        lines.append("  Les handlers _handle_next_match, _handle_last_result,")
        lines.append("  _handle_form et _handle_schedule du PreRouter passent")
        lines.append("  des parametres 'next' et 'last' au tool get_fixtures,")
        lines.append("  mais la signature du tool n'accepte que :")
        lines.append("  league_id, team_id, season, date.")
        lines.append("  Cela provoque un TypeError silencieusement avale par")
        lines.append("  le bloc except Exception, renvoyant None -> fallback.")
        lines.append(f"  Questions affectees : {len(broken_prerouter)}")
        for r in broken_prerouter:
            lines.append(f"    - \"{r.question}\" ({r.category})")

    # Detecter les questions sans LLM qui tombent en fallback
    no_llm_fallbacks = [
        r for r in report.question_results
        if "fallback" in r.route
        and r.category not in prerouter_categories
        and r.category not in {"edge_case", "hors_scope"}
    ]
    if no_llm_fallbacks:
        lines.append("")
        lines.append("  BUG #2 : Questions sans route (LLM desactive)")
        lines.append("  " + "-" * 60)
        lines.append("  Sans LLM, ces categories de questions tombent")
        lines.append("  directement en fallback car aucun pattern prerouter")
        lines.append("  ne les couvre et l'orchestrateur est inactif :")
        affected_cats = set(r.category for r in no_llm_fallbacks)
        for cat in sorted(affected_cats):
            count = sum(1 for r in no_llm_fallbacks if r.category == cat)
            lines.append(f"    - {cat} ({count} questions)")
        lines.append("  => Ces questions necessitent le LLM (orchestrateur)")
        lines.append("     ou des patterns prerouter supplementaires.")

    # -- Conclusion --
    lines.append("")
    lines.append(sep)
    lines.append("CONCLUSION")
    lines.append(sep)

    issues: list[str] = []
    if failures > 0:
        issues.append(f"{failures} question(s) en echec")
    if degraded_count > total * 0.3:
        issues.append(f"Trop de reponses degradees ({degraded_count}/{total})")
    if avg_latency > 3000:
        issues.append(f"Latence moyenne elevee ({avg_latency:.0f}ms)")
    if broken_prerouter:
        issues.append(
            f"BUG: {len(broken_prerouter)} questions prerouter cassees "
            "(params next/last non supportes par get_fixtures)"
        )

    if not issues:
        lines.append("  La campagne s'est deroulee sans probleme majeur.")
    else:
        lines.append("  Points d'attention :")
        for issue in issues:
            lines.append(f"    - {issue}")

    lines.append("")
    lines.append("  Recommandations :")
    lines.append("    1. Ajouter les parametres 'next' et 'last' a la signature")
    lines.append("       de get_fixtures dans tools/football.py")
    lines.append("    2. Tester avec enable_llm=True pour valider l'orchestrateur")
    lines.append("    3. Ajouter des patterns prerouter pour blessures, joueurs, cotes")
    lines.append("")
    lines.append(sep)
    return "\n".join(lines)


def _report_to_dict(report: CampaignReport) -> dict[str, Any]:
    """Convertit le rapport en dict pour le JSON."""
    return {
        "summary": {
            "total_questions": len(report.question_results),
            "successes": sum(1 for r in report.question_results if r.success),
            "failures": sum(1 for r in report.question_results if not r.success),
            "total_api_calls": report.total_api_calls,
            "budget_before": report.budget_before,
            "budget_after": report.budget_after,
            "duration_ms": report.total_duration_ms,
        },
        "questions": [
            {
                "category": r.category,
                "question": r.question,
                "context": r.context.model_dump(exclude_none=True),
                "route": r.route,
                "response_text": r.response_text,
                "has_attachments": r.has_attachments,
                "attachment_kinds": r.attachment_kinds,
                "degraded": r.degraded,
                "latency_ms": r.latency_ms,
                "success": r.success,
                "error": r.error,
                "api_calls": r.api_calls_after - r.api_calls_before,
            }
            for r in report.question_results
        ],
        "cache_tests": [
            {
                "category": r.category,
                "question_v1": r.question_v1,
                "question_v2": r.question_v2,
                "latency_v1_ms": r.latency_v1_ms,
                "latency_v2_ms": r.latency_v2_ms,
                "speedup_ratio": r.speedup_ratio,
                "api_calls_v1": r.api_calls_v1,
                "api_calls_v2": r.api_calls_v2,
                "cache_hit": r.cache_hit,
            }
            for r in report.cache_results
        ],
    }
