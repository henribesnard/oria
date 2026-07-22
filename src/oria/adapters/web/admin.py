"""Endpoints admin — protégés par ADMIN_TOKEN.

Routes :
  /admin/health        — santé détaillée de tous les modules
  /admin/metrics       — métriques agrégées (p50/p95/p99)
  /admin/quota         — état du governor API-Football
  /admin/traces        — liste des traces récentes
  /admin/trace/{id}    — détail d'une trace
  /admin/bottlenecks   — goulots détectés
  /admin/live          — état du live engine
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Header, HTTPException

if TYPE_CHECKING:
    from oria.kernel.health import HealthRegistry
    from oria.monitoring.collector import Collector
    from oria.providers.apifootball.client import ApiFootballClient

router = APIRouter(prefix="/admin", tags=["admin"])

# Injectés au démarrage
_admin_token: str = ""
_health_registry: HealthRegistry | None = None
_collector: Collector | None = None
_apifootball: ApiFootballClient | None = None


def init_admin_routes(
    *,
    admin_token: str,
    health_registry: HealthRegistry | None = None,
    collector: Collector | None = None,
    apifootball: ApiFootballClient | None = None,
) -> None:
    """Câble les dépendances admin depuis le conteneur."""
    global _admin_token, _health_registry, _collector, _apifootball  # noqa: PLW0603
    _admin_token = admin_token
    _health_registry = health_registry
    _collector = collector
    _apifootball = apifootball


def _check_token(authorization: str | None) -> None:
    """Vérifie le token admin. Lève 401 si invalide."""
    if not _admin_token:
        raise HTTPException(
            status_code=503,
            detail="Admin endpoints not configured (ADMIN_TOKEN missing)",
        )
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing Bearer token")
    token = authorization.removeprefix("Bearer ").strip()
    if token != _admin_token:
        raise HTTPException(status_code=401, detail="Invalid admin token")


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/health")
async def admin_health(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Santé détaillée de tous les modules."""
    _check_token(authorization)
    if _health_registry is None:
        return {"status": "starting", "modules": {}}
    snapshot = _health_registry.snapshot()
    return {
        "modules": {
            name: s.model_dump() for name, s in snapshot.items()
        },
    }


@router.get("/metrics")
async def admin_metrics(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Métriques agrégées (p50/p95/p99 par span)."""
    _check_token(authorization)
    if _collector is None:
        return {"error": "monitoring not available"}
    return _collector.get_metrics()


@router.get("/quota")
async def admin_quota(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """État du governor API-Football."""
    _check_token(authorization)
    if _apifootball is None:
        return {"error": "apifootball not configured"}
    return _apifootball.governor.snapshot()


@router.get("/traces")
async def admin_traces(
    authorization: str | None = Header(default=None),
    limit: int = 20,
) -> list[dict[str, Any]]:
    """Liste des traces récentes."""
    _check_token(authorization)
    if _collector is None:
        return []
    # Parcourir le ring buffer (les plus récentes d'abord)
    out: list[dict[str, Any]] = []
    for record in reversed(_collector._recent):  # noqa: SLF001
        out.append({
            "trace_id": record.trace_id,
            "total_duration_ms": record.total_duration_ms,
            "span_count": len(record.spans),
        })
        if len(out) >= limit:
            break
    return out


@router.get("/trace/{trace_id}")
async def admin_trace(
    trace_id: str,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """Détail d'une trace (arbre de spans)."""
    _check_token(authorization)
    if _collector is None:
        return {"error": "monitoring not available"}
    record = _collector.get_trace(trace_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Trace not found")
    return {
        "trace_id": record.trace_id,
        "total_duration_ms": record.total_duration_ms,
        "spans": record.spans,
    }


@router.get("/bottlenecks")
async def admin_bottlenecks(
    authorization: str | None = Header(default=None),
) -> list[dict[str, Any]]:
    """Goulots détectés (spans > stage_budget_ms)."""
    _check_token(authorization)
    if _collector is None:
        return []
    return _collector.get_bottlenecks()


@router.get("/live")
async def admin_live(
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    """État du live engine (stub)."""
    _check_token(authorization)
    return {"status": "not_implemented"}
