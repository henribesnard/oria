"""Tests des endpoints admin protégés par ADMIN__FAKE_ADMIN."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from oria.adapters.web.admin import init_admin_routes
from oria.adapters.web.app import app
from oria.kernel.health import Availability, HealthRegistry, ModuleStatus
from oria.monitoring.collector import Collector

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_FAKE_ADMIN = "fake-admin-value-for-tests"  # noqa: S105


@pytest.fixture(autouse=True)
def _setup_admin() -> None:
    """Configure les routes admin pour les tests."""
    registry = HealthRegistry()
    registry.set(
        ModuleStatus(name="cache", availability=Availability.UP),
    )
    registry.set(
        ModuleStatus(name="apifootball", availability=Availability.UP),
    )

    collector = Collector(buffer_size=100, stage_budget_ms=1000.0)

    init_admin_routes(
        admin_token=_FAKE_ADMIN,
        health_registry=registry,
        collector=collector,
    )


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _auth_headers() -> dict[str, str]:
    return {"Authorization": f"Bearer {_FAKE_ADMIN}"}


# ---------------------------------------------------------------------------
# Tests d'authentification
# ---------------------------------------------------------------------------


class TestAdminAuth:
    """Vérifie que les endpoints admin rejettent les appels non autorisés."""

    def test_no_token_returns_401(self, client: TestClient) -> None:
        resp = client.get("/admin/health")
        assert resp.status_code == 401

    def test_wrong_token_returns_401(self, client: TestClient) -> None:
        resp = client.get(
            "/admin/health",
            headers={"Authorization": "Bearer wrong-token"},
        )
        assert resp.status_code == 401

    def test_valid_token_returns_200(self, client: TestClient) -> None:
        resp = client.get("/admin/health", headers=_auth_headers())
        assert resp.status_code == 200

    def test_missing_bearer_prefix(self, client: TestClient) -> None:
        resp = client.get(
            "/admin/health",
            headers={"Authorization": _FAKE_ADMIN},
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# Tests des endpoints
# ---------------------------------------------------------------------------


class TestAdminEndpoints:
    """Teste le contenu des réponses admin."""

    def test_health(self, client: TestClient) -> None:
        resp = client.get("/admin/health", headers=_auth_headers())
        data: dict[str, Any] = resp.json()
        assert "modules" in data
        assert "cache" in data["modules"]
        assert data["modules"]["cache"]["availability"] == "up"

    def test_metrics_empty(self, client: TestClient) -> None:
        resp = client.get("/admin/metrics", headers=_auth_headers())
        data: dict[str, Any] = resp.json()
        # Pas de spans émis → métriques vides
        assert isinstance(data, dict)

    def test_quota_no_apifootball(self, client: TestClient) -> None:
        """Sans client apifootball, retourne erreur."""
        resp = client.get("/admin/quota", headers=_auth_headers())
        data: dict[str, Any] = resp.json()
        assert "error" in data

    def test_traces_empty(self, client: TestClient) -> None:
        resp = client.get("/admin/traces", headers=_auth_headers())
        data: list[dict[str, Any]] = resp.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_trace_not_found(self, client: TestClient) -> None:
        resp = client.get(
            "/admin/trace/nonexistent",
            headers=_auth_headers(),
        )
        assert resp.status_code == 404

    def test_bottlenecks_empty(self, client: TestClient) -> None:
        resp = client.get(
            "/admin/bottlenecks",
            headers=_auth_headers(),
        )
        data: list[dict[str, Any]] = resp.json()
        assert isinstance(data, list)

    def test_live_stub(self, client: TestClient) -> None:
        resp = client.get("/admin/live", headers=_auth_headers())
        data: dict[str, Any] = resp.json()
        assert data["status"] == "not_implemented"


class TestAdminWithCollectorData:
    """Teste les endpoints avec des données dans le collector."""

    def test_traces_with_data(self, client: TestClient) -> None:
        """Après injection d'un span, la trace est visible."""
        # Reconfigurer avec un collector ayant des données
        collector = Collector(buffer_size=100, stage_budget_ms=1000.0)

        import asyncio

        async def _inject() -> None:
            await collector.handle_span({
                "trace_id": "abc123",
                "span_id": "s1",
                "name": "test.span",
                "duration_ms": 50.0,
                "status": "ok",
            })
            collector.finalize_trace("abc123")

        asyncio.run(_inject())

        init_admin_routes(
            admin_token=_FAKE_ADMIN,
            health_registry=HealthRegistry(),
            collector=collector,
        )

        resp = client.get("/admin/traces", headers=_auth_headers())
        data: list[dict[str, Any]] = resp.json()
        assert len(data) == 1
        assert data[0]["trace_id"] == "abc123"

        # Détail de la trace
        resp2 = client.get(
            "/admin/trace/abc123",
            headers=_auth_headers(),
        )
        detail: dict[str, Any] = resp2.json()
        assert detail["trace_id"] == "abc123"
        assert len(detail["spans"]) == 1

    def test_metrics_with_data(self, client: TestClient) -> None:
        """Après injection de spans, les métriques sont agrégées."""
        collector = Collector(buffer_size=100, stage_budget_ms=1000.0)

        import asyncio

        async def _inject() -> None:
            for i in range(5):
                await collector.handle_span({
                    "trace_id": f"t{i}",
                    "span_id": f"s{i}",
                    "name": "apifootball.fetch",
                    "duration_ms": 100.0 + i * 10,
                    "status": "ok",
                })

        asyncio.run(_inject())

        init_admin_routes(
            admin_token=_FAKE_ADMIN,
            health_registry=HealthRegistry(),
            collector=collector,
        )

        resp = client.get("/admin/metrics", headers=_auth_headers())
        data: dict[str, Any] = resp.json()
        assert "apifootball.fetch" in data
        assert data["apifootball.fetch"]["count"] == 5


class TestAdminNoToken:
    """Teste le cas où ADMIN__FAKE_ADMIN n'est pas configuré."""

    def test_no_admin_token_returns_503(self, client: TestClient) -> None:
        init_admin_routes(admin_token="")
        resp = client.get(
            "/admin/health",
            headers={"Authorization": "Bearer anything"},
        )
        assert resp.status_code == 503
