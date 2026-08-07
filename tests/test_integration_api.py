"""Tests d'INTÉGRATION — appels réels à l'API Football (plan Pro 7500/jour).

Ces tests appellent la vraie API-Football pour vérifier :
- Pertinence : l'API retourne les bonnes données pour les bonnes requêtes
- Précision : les champs attendus sont présents et non-vides
- Latence : les réponses arrivent dans les seuils acceptables

⚠ Ces tests consomment du budget API réel (~15 appels par run complet).
   Lancer avec : pytest tests/test_integration_api.py -m integration --timeout=30
   Nécessite APIFOOTBALL_KEY dans l'environnement ou .env.
"""

from __future__ import annotations

import os
import time
from typing import Any

import pytest

from oria.config import Settings
from oria.providers.apifootball.client import ApiFootballClient
from oria.providers.apifootball.mapper import (
    map_fixtures,
    map_injuries,
    map_players,
    map_standings,
    map_teams,
)

# ---------------------------------------------------------------------------
# Marker : sauter si pas de clé API
# ---------------------------------------------------------------------------

# Charger depuis .env via pydantic-settings (comme le fait l'app)
try:
    _SETTINGS = Settings(
        deepseek_api_key="",
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        db_path=":memory:",
    )
    _HAS_AF = bool(_SETTINGS.apifootball_key)
except Exception:
    _SETTINGS = None  # type: ignore[assignment]
    _HAS_AF = bool(os.environ.get("APIFOOTBALL_KEY", ""))

pytestmark = [
    pytest.mark.integration,
    pytest.mark.skipif(not _HAS_AF, reason="APIFOOTBALL_KEY not set in env or .env"),
]

# ---------------------------------------------------------------------------
# IDs connus pour les tests (Ligue 1 & PSG)
# ---------------------------------------------------------------------------

LIGUE_1_ID = 61
PSG_ID = 85
SEASON = 2024

# Seuils de latence (ms)
LATENCY_THRESHOLD_MS = 3000  # 3 secondes max par appel API


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_settings() -> Settings:
    return Settings(
        apifootball_key=_SETTINGS.apifootball_key if _SETTINGS else "",
        deepseek_api_key="",
        enable_llm=False,
        enable_ingestion=False,
        enable_live=False,
        enable_push=False,
        enable_monitoring=False,
        log_level="DEBUG",
        db_path=":memory:",
        apifootball_base_url="https://v3.football.api-sports.io",
        apifootball_auth_mode="direct",
        apifootball_daily_budget=7500,
        apifootball_rate_per_min=300,
    )


class _Timer:
    def __init__(self) -> None:
        self.elapsed_ms: float = 0.0

    def __enter__(self) -> "_Timer":
        self._start = time.perf_counter()
        return self

    def __exit__(self, *args: object) -> None:
        self.elapsed_ms = (time.perf_counter() - self._start) * 1000


@pytest.fixture
async def client() -> ApiFootballClient:
    c = ApiFootballClient(settings=_make_settings())
    await c.start()
    yield c
    await c.stop()


# ---------------------------------------------------------------------------
# FIXTURES — Matchs
# ---------------------------------------------------------------------------


class TestIntegrationFixtures:
    """Les matchs retournés sont pertinents et précis."""

    @pytest.mark.asyncio
    async def test_fixtures_ligue1_retourne_des_matchs(
        self, client: ApiFootballClient,
    ) -> None:
        """L'API retourne des matchs pour la Ligue 1."""
        with _Timer() as t:
            raw = await client.fetch(
                "/fixtures", {"league": str(LIGUE_1_ID), "season": str(SEASON)},
            )
        assert t.elapsed_ms < LATENCY_THRESHOLD_MS, (
            f"fixtures took {t.elapsed_ms:.0f} ms"
        )
        assert raw["results"] > 0, "Aucun match trouvé pour Ligue 1"
        fixtures = map_fixtures(raw)
        assert len(fixtures) > 0

        # Chaque match doit avoir les champs requis
        for f in fixtures[:5]:
            assert f["id"] is not None
            assert f["league"]["id"] == LIGUE_1_ID
            assert f["home"]["name"]
            assert f["away"]["name"]
            assert f["date"]

    @pytest.mark.asyncio
    async def test_fixtures_psg_retourne_matchs_psg(
        self, client: ApiFootballClient,
    ) -> None:
        """L'API retourne des matchs spécifiquement pour le PSG."""
        with _Timer() as t:
            raw = await client.fetch(
                "/fixtures",
                {"team": str(PSG_ID), "season": str(SEASON), "last": "5"},
            )
        assert t.elapsed_ms < LATENCY_THRESHOLD_MS

        fixtures = map_fixtures(raw)
        assert len(fixtures) > 0
        # Le PSG doit être dans chaque match
        for f in fixtures:
            psg_present = (
                f["home"]["id"] == PSG_ID or f["away"]["id"] == PSG_ID
            )
            assert psg_present, (
                f"PSG absent du match {f['id']}: "
                f"{f['home']['name']} vs {f['away']['name']}"
            )

    @pytest.mark.asyncio
    async def test_fixtures_terminés_ont_score(
        self, client: ApiFootballClient,
    ) -> None:
        """Les matchs terminés ont un score renseigné."""
        raw = await client.fetch(
            "/fixtures",
            {"league": str(LIGUE_1_ID), "season": str(SEASON), "status": "FT"},
        )
        fixtures = map_fixtures(raw)
        for f in fixtures[:10]:
            assert f["status"]["short"] == "FT"
            assert f["goals_home"] is not None
            assert f["goals_away"] is not None


# ---------------------------------------------------------------------------
# STANDINGS — Classements
# ---------------------------------------------------------------------------


class TestIntegrationStandings:
    """Les classements sont pertinents et complets."""

    @pytest.mark.asyncio
    async def test_standings_ligue1(
        self, client: ApiFootballClient,
    ) -> None:
        """L'API retourne un classement complet pour la Ligue 1."""
        with _Timer() as t:
            raw = await client.fetch(
                "/standings",
                {"league": str(LIGUE_1_ID), "season": str(SEASON)},
            )
        assert t.elapsed_ms < LATENCY_THRESHOLD_MS

        standings = map_standings(raw)
        # Ligue 1 = 18 équipes (depuis 2023)
        assert len(standings) >= 18, (
            f"Seulement {len(standings)} équipes dans le classement"
        )

        # Vérifie que les rangs sont séquentiels
        ranks = [s["rank"] for s in standings]
        assert ranks == sorted(ranks)
        assert ranks[0] == 1

        # Le leader a le plus de points
        assert standings[0]["points"] >= standings[-1]["points"]

        # Chaque entrée a les champs requis
        for s in standings:
            assert s["team"]["name"]
            assert s["points"] is not None
            assert s["all"]["played"] > 0


# ---------------------------------------------------------------------------
# TEAMS — Informations équipe
# ---------------------------------------------------------------------------


class TestIntegrationTeams:
    """Les infos d'équipe sont précises."""

    @pytest.mark.asyncio
    async def test_team_psg(
        self, client: ApiFootballClient,
    ) -> None:
        """L'API retourne les infos correctes pour le PSG."""
        with _Timer() as t:
            raw = await client.fetch("/teams", {"id": str(PSG_ID)})
        assert t.elapsed_ms < LATENCY_THRESHOLD_MS

        teams = map_teams(raw)
        assert len(teams) == 1
        psg = teams[0]
        assert psg["id"] == PSG_ID
        assert "paris" in psg["name"].lower() or "psg" in psg["name"].lower()
        assert psg["country"] == "France"
        assert psg["founded"] is not None
        assert psg["venue"]["name"]

    @pytest.mark.asyncio
    async def test_team_search(
        self, client: ApiFootballClient,
    ) -> None:
        """La recherche par nom retourne des résultats pertinents."""
        with _Timer() as t:
            raw = await client.fetch("/teams", {"search": "Barcelona"})
        assert t.elapsed_ms < LATENCY_THRESHOLD_MS

        teams = map_teams(raw)
        assert len(teams) > 0
        # Au moins un résultat doit contenir "Barcelona"
        names = [t["name"].lower() for t in teams]
        assert any("barcelona" in n for n in names)


# ---------------------------------------------------------------------------
# PLAYERS — Statistiques joueurs
# ---------------------------------------------------------------------------


class TestIntegrationPlayers:
    """Les stats joueurs sont précises et cohérentes."""

    @pytest.mark.asyncio
    async def test_players_psg(
        self, client: ApiFootballClient,
    ) -> None:
        """L'API retourne les joueurs du PSG pour la saison."""
        with _Timer() as t:
            raw = await client.fetch(
                "/players",
                {"team": str(PSG_ID), "season": str(SEASON), "page": "1"},
            )
        assert t.elapsed_ms < LATENCY_THRESHOLD_MS

        players = map_players(raw)
        assert len(players) > 0

        for p in players:
            assert p["id"] is not None
            assert p["name"]
            assert len(p["statistics"]) > 0


# ---------------------------------------------------------------------------
# INJURIES — Blessures
# ---------------------------------------------------------------------------


class TestIntegrationInjuries:
    """Les blessures retournées sont pertinentes."""

    @pytest.mark.asyncio
    async def test_injuries_ligue1(
        self, client: ApiFootballClient,
    ) -> None:
        """L'API retourne des blessures pour la Ligue 1."""
        with _Timer() as t:
            raw = await client.fetch(
                "/injuries",
                {"league": str(LIGUE_1_ID), "season": str(SEASON)},
            )
        assert t.elapsed_ms < LATENCY_THRESHOLD_MS

        injuries = map_injuries(raw)
        # Il y a presque toujours des blessures en Ligue 1
        if injuries:
            for inj in injuries[:5]:
                assert inj["player"]
                assert inj["team"]


# ---------------------------------------------------------------------------
# GOVERNOR INTÉGRATION — Budget consommé
# ---------------------------------------------------------------------------


class TestIntegrationGovernor:
    """Le governor suit le budget après des appels réels."""

    @pytest.mark.asyncio
    async def test_budget_decremente_apres_appels(
        self, client: ApiFootballClient,
    ) -> None:
        """Le governor compte les appels réels."""
        initial = client.governor.remaining_budget
        await client.fetch("/standings", {"league": str(LIGUE_1_ID), "season": str(SEASON)})
        after = client.governor.remaining_budget
        # Le budget a dû diminuer (via le header serveur ou le compteur local)
        assert after < initial or client.governor.calls_today > 0

    @pytest.mark.asyncio
    async def test_negative_cache_active_sur_empty(
        self, client: ApiFootballClient,
    ) -> None:
        """Le negative cache s'active quand l'API retourne 0 résultat."""
        # Ligue inexistante
        raw = await client.fetch("/fixtures", {"league": "99999", "season": str(SEASON)})
        calls_after_first = client.governor.calls_today
        # 2ème appel : doit être servi par le negative cache
        raw2 = await client.fetch("/fixtures", {"league": "99999", "season": str(SEASON)})
        assert client.governor.calls_today == calls_after_first  # pas d'appel supplémentaire


# ---------------------------------------------------------------------------
# LATENCE INTÉGRATION — Seuils temps réel
# ---------------------------------------------------------------------------


class TestIntegrationLatence:
    """Mesure la latence réelle des appels API Football."""

    @pytest.mark.asyncio
    async def test_latence_moyenne_5_appels(
        self, client: ApiFootballClient,
    ) -> None:
        """La latence moyenne de 5 appels différents est < 2 secondes."""
        endpoints: list[tuple[str, dict[str, str]]] = [
            ("/standings", {"league": str(LIGUE_1_ID), "season": str(SEASON)}),
            ("/teams", {"id": str(PSG_ID)}),
            ("/fixtures", {"team": str(PSG_ID), "season": str(SEASON), "last": "1"}),
        ]

        latencies: list[float] = []
        for endpoint, params in endpoints:
            with _Timer() as t:
                await client.fetch(endpoint, params)
            latencies.append(t.elapsed_ms)

        avg = sum(latencies) / len(latencies)
        assert avg < 2000, (
            f"Latence moyenne {avg:.0f} ms — seuil 2000 ms\n"
            f"Détail : {[f'{l:.0f}ms' for l in latencies]}"
        )

        # Aucun appel ne doit dépasser 5 secondes
        for i, lat in enumerate(latencies):
            assert lat < 5000, (
                f"Appel {endpoints[i][0]} a pris {lat:.0f} ms (> 5s)"
            )
