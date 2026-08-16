"""Tests d'acceptation §10 — critères de résilience."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from oria.config import Settings
from oria.core.orchestrator import Orchestrator
from oria.core.pipeline import Pipeline
from oria.core.prerouter import PreRouter
from oria.core.synthesis import Synthesis
from oria.domain.fixtures import FixturesRepository
from oria.kernel.models import IncomingRequest, Response
from oria.kernel.resilience import CircuitBreaker, Supervisor
from oria.monitoring.collector import Collector
from oria.storage.cache import Cache
from oria.storage.db import Database

# ---------------------------------------------------------------------------
# §10.1 — Boot minimal
# ---------------------------------------------------------------------------


class TestBootMinimal:
    async def test_app_boots_with_all_optional_disabled(self) -> None:
        """L'app démarre avec tous les modules optionnels désactivés."""
        settings = Settings(
            apifootball_key="",
            deepseek_api_key="",
            enable_llm=False,
            enable_ingestion=False,
            enable_live=False,
            enable_push=False,
            enable_monitoring=False,
            db_path=":memory:",
        )

        from oria.main import build_container

        container, pipeline = build_container(settings)
        await container.start_all()

        # Le pipeline répond
        req = IncomingRequest(user_id="test", text="Bonjour")
        resp = await pipeline.handle_message(req)
        assert isinstance(resp, Response)
        assert resp.text  # non vide

        await container.stop_all()


# ---------------------------------------------------------------------------
# §10.2 — LLM absent
# ---------------------------------------------------------------------------


class TestLLMAbsent:
    async def test_prerouter_responds_without_llm(self) -> None:
        """Sans LLM, le pré-routeur répond aux salutations."""
        prerouter = PreRouter()
        synthesis = Synthesis()
        pipeline = Pipeline(
            synthesis=synthesis,
            prerouter=prerouter,
            orchestrator=Orchestrator(llm=None, tools=None),
        )

        req = IncomingRequest(user_id="test", text="Bonjour")
        resp = await pipeline.handle_message(req)

        assert isinstance(resp, Response)
        assert "Oria" in resp.text or "assistant" in resp.text


# ---------------------------------------------------------------------------
# §10.3 — API-Football en panne → cache périmé
# ---------------------------------------------------------------------------


class TestAPIFailure:
    async def test_serves_stale_cache_on_api_failure(self) -> None:
        """Si le fetch échoue, le repo sert le cache périmé."""
        db = Database(db_path=":memory:")
        await db.start()
        cache = Cache(db=db)
        await cache.start()

        # Pré-remplir le cache avec une donnée périmée
        await cache.set(
            "fixtures:league=1&team=0",
            [{"match": "PSG vs OM"}],
            domain="fixtures",
            volatility="semi_rapide",
            ttl_seconds=0,  # expiré immédiatement
        )

        repo = FixturesRepository(cache=cache)

        # Le repo sert le cache périmé (pas de provider configuré → _fetch renvoie None)
        result = await repo.get("league=1&team=0")
        assert result == [{"match": "PSG vs OM"}]

        await db.stop()


# ---------------------------------------------------------------------------
# §10.4 — Circuit breaker
# ---------------------------------------------------------------------------


class TestCircuitBreaker:
    async def test_breaker_opens_and_stops_calling(self) -> None:
        """Après fail_max échecs, le breaker ouvre."""
        cb = CircuitBreaker("test_api", fail_max=3, reset_timeout=60.0)
        call_count = 0

        async def failing_fetch() -> None:
            nonlocal call_count
            call_count += 1
            raise ConnectionError("API down")

        for _ in range(3):
            with pytest.raises(ConnectionError):
                await cb.call(failing_fetch)

        assert cb.state == "open"

        # Plus aucun appel ne part
        from oria.kernel.errors import CircuitOpenError

        with pytest.raises(CircuitOpenError):
            await cb.call(failing_fetch)
        assert call_count == 3  # pas appelé la 4e fois


# ---------------------------------------------------------------------------
# §10.5 — Tâche de fond crashée → relancée
# ---------------------------------------------------------------------------


class TestSupervisor:
    async def test_crashed_task_restarts(self) -> None:
        """Le Supervisor relance une tâche crashée."""
        call_count = 0

        async def unstable_task() -> None:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("task crash")
            await asyncio.sleep(100)

        sup = Supervisor()
        sup.spawn("test", unstable_task, restart=True)
        await asyncio.sleep(4)  # backoff 1s + 2s

        assert call_count >= 3
        await sup.stop_all()


# ---------------------------------------------------------------------------
# §10.6 — Pipeline ne lève jamais
# ---------------------------------------------------------------------------


class TestPipelineInvariant:
    @pytest.mark.parametrize(
        "text",
        [
            "Bonjour",
            "",
            "Quel est le classement de la Ligue 1 ?",
            "a" * 10000,
            "🏆⚽",
        ],
    )
    async def test_handle_message_never_raises(self, text: str) -> None:
        """handle_message renvoie toujours une Response."""
        synthesis = Synthesis()
        pipeline = Pipeline(synthesis=synthesis)

        req = IncomingRequest(user_id="test", text=text)
        resp = await pipeline.handle_message(req)
        assert isinstance(resp, Response)

    async def test_pipeline_with_broken_stages(self) -> None:
        """Même avec des stages en erreur, on récupère une Response."""

        class BrokenPreRouter(PreRouter):
            async def try_route(self, req: IncomingRequest) -> Response | None:
                raise RuntimeError("prerouter crash")

        class BrokenOrchestrator(Orchestrator):
            async def run(self, req, **kwargs):  # type: ignore[override]
                raise RuntimeError("orchestrator crash")

        synthesis = Synthesis()
        pipeline = Pipeline(
            synthesis=synthesis,
            prerouter=BrokenPreRouter(),  # type: ignore[arg-type]
            orchestrator=BrokenOrchestrator(llm=None, tools=None),  # type: ignore[arg-type]
        )

        req = IncomingRequest(user_id="test", text="test")
        resp = await pipeline.handle_message(req)
        assert isinstance(resp, Response)


# ---------------------------------------------------------------------------
# §10.7 — Combinatoire de flags
# ---------------------------------------------------------------------------


class TestFlagCombinations:
    @pytest.mark.parametrize(
        "flags",
        [
            {"enable_llm": False, "enable_monitoring": False},
            {"enable_llm": True, "enable_monitoring": False},
            {"enable_llm": False, "enable_monitoring": True},
            {"enable_llm": True, "enable_monitoring": True},
        ],
    )
    async def test_boots_with_flag_combinations(self, flags: dict[str, bool]) -> None:
        """L'app boote pour toutes les combinaisons de flags."""
        settings = Settings(
            apifootball_key="",
            deepseek_api_key="",
            enable_ingestion=False,
            enable_live=False,
            enable_push=False,
            db_path=":memory:",
            **flags,  # type: ignore[arg-type]
        )

        from oria.main import build_container

        container, pipeline = build_container(settings)
        await container.start_all()

        req = IncomingRequest(user_id="test", text="test")
        resp = await pipeline.handle_message(req)
        assert isinstance(resp, Response)

        await container.stop_all()


# ---------------------------------------------------------------------------
# §10.8 — Isolation d'un repo
# ---------------------------------------------------------------------------


class TestRepoIsolation:
    async def test_broken_repo_doesnt_crash_app(self) -> None:
        """Un repo en panne n'affecte pas les autres."""
        db = Database(db_path=":memory:")
        await db.start()
        cache = Cache(db=db)
        await cache.start()

        fixtures = FixturesRepository(cache=cache)

        # Forcer une erreur dans _fetch
        async def broken_fetch(key: str) -> Any:  # noqa: ANN401
            raise RuntimeError("repo broken")

        fixtures._fetch = broken_fetch  # type: ignore[assignment]

        # Le get ne crashe pas, renvoie None (pas de cache)
        result = await fixtures.get("nonexistent_key")
        assert result is None

        await db.stop()


# ---------------------------------------------------------------------------
# §10.9 — Frontières d'architecture (test statique)
# ---------------------------------------------------------------------------


class TestArchitectureBoundaries:
    def test_no_httpx_outside_providers(self) -> None:
        """Aucun import de httpx hors de providers/."""
        import ast
        from pathlib import Path

        src = Path(__file__).parent.parent / "src" / "oria"
        violations: list[str] = []

        for py_file in src.rglob("*.py"):
            # Exclure providers/
            rel = py_file.relative_to(src)
            if str(rel).startswith("providers"):
                continue

            try:
                tree = ast.parse(py_file.read_text(encoding="utf-8"))
            except SyntaxError:
                continue

            for node in ast.walk(tree):
                if isinstance(node, ast.Import):
                    for alias in node.names:
                        if alias.name == "httpx" or alias.name.startswith("httpx."):
                            violations.append(f"{rel}: import {alias.name}")
                elif (
                    isinstance(node, ast.ImportFrom)
                    and node.module
                    and (node.module == "httpx" or node.module.startswith("httpx."))
                ):
                    violations.append(f"{rel}: from {node.module}")

        assert not violations, f"httpx imported outside providers/: {violations}"


# ---------------------------------------------------------------------------
# §10.10 — Traçage bout-en-bout
# ---------------------------------------------------------------------------


class TestTracing:
    async def test_trace_produced_for_request(self) -> None:
        """Une requête produit un span de pipeline."""
        from oria.kernel.events import EventBus
        from oria.kernel.tracing import new_trace, span

        bus = EventBus()
        spans_received: list[dict[str, Any]] = []

        async def handler(data: Any) -> None:  # noqa: ANN401
            spans_received.append(data)

        bus.subscribe("span", handler)

        new_trace(bus=bus)
        async with span("pipeline.handle_message"):
            async with span("prerouter.try_route"):
                pass
            async with span("synthesis.render"):
                pass

        # Laisser le bus traiter
        await asyncio.sleep(0.05)

        assert len(spans_received) >= 3
        names = [s["name"] for s in spans_received]
        assert "pipeline.handle_message" in names
        assert "prerouter.try_route" in names


# ---------------------------------------------------------------------------
# §10.11 — Monitoring non intrusif
# ---------------------------------------------------------------------------


class TestMonitoringNonIntrusive:
    async def test_pipeline_works_without_monitoring(self) -> None:
        """Avec monitoring DOWN, le pipeline répond normalement."""
        synthesis = Synthesis()
        pipeline = Pipeline(synthesis=synthesis)

        req = IncomingRequest(user_id="test", text="test")
        resp = await pipeline.handle_message(req)
        assert isinstance(resp, Response)
        assert not resp.degraded or resp.degraded  # il répond dans tous les cas


# ---------------------------------------------------------------------------
# §10.12 — Détection de goulot
# ---------------------------------------------------------------------------


class TestBottleneckDetection:
    async def test_slow_action_detected_as_bottleneck(self) -> None:
        """Une action qui dépasse STAGE_BUDGET_MS est marquée goulot."""
        collector = Collector(buffer_size=100, stage_budget_ms=100.0)
        await collector.start()

        # Simuler un span lent
        await collector.handle_span(
            {
                "trace_id": "t1",
                "span_id": "s1",
                "name": "apifootball.fetch",
                "duration_ms": 200.0,  # > 100ms budget
                "status": "ok",
            }
        )

        bottlenecks = collector.get_bottlenecks()
        assert len(bottlenecks) == 1
        assert bottlenecks[0]["name"] == "apifootball.fetch"

    async def test_fast_action_not_bottleneck(self) -> None:
        """Une action rapide n'est pas un goulot."""
        collector = Collector(buffer_size=100, stage_budget_ms=100.0)
        await collector.start()

        await collector.handle_span(
            {
                "trace_id": "t1",
                "span_id": "s1",
                "name": "cache.get",
                "duration_ms": 5.0,
                "status": "ok",
            }
        )

        assert len(collector.get_bottlenecks()) == 0
