"""Endpoints admin — protégés par ADMIN_TOKEN ou JWT role=admin.

Routes monitoring (Bearer token) :
  /admin/health        — santé détaillée de tous les modules
  /admin/metrics       — métriques agrégées (p50/p95/p99)
  /admin/quota         — état du governor API-Football
  /admin/traces        — liste des traces récentes
  /admin/trace/{id}    — détail d'une trace
  /admin/bottlenecks   — goulots détectés
  /admin/live          — état du live engine

Routes gestion (JWT admin) :
  /admin/users         — liste des utilisateurs
  /admin/users/{id}    — détail / mise à jour d'un utilisateur
  /admin/bootstrap     — création du premier admin (no auth, token body)
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel

from oria.adapters.web.dependencies import get_current_user

if TYPE_CHECKING:
    from oria.app.admin.service import AdminService
    from oria.kernel.health import HealthRegistry
    from oria.monitoring.collector import Collector
    from oria.providers.apifootball.client import ApiFootballClient

router = APIRouter(prefix="/admin", tags=["admin"])

# Injectés au démarrage
_admin_token: str = ""
_health_registry: HealthRegistry | None = None
_collector: Collector | None = None
_apifootball: ApiFootballClient | None = None
_admin_service: AdminService | None = None


def init_admin_routes(
    *,
    admin_token: str,
    health_registry: HealthRegistry | None = None,
    collector: Collector | None = None,
    apifootball: ApiFootballClient | None = None,
    admin_service: AdminService | None = None,
) -> None:
    """Câble les dépendances admin depuis le conteneur."""
    global _admin_token, _health_registry, _collector, _apifootball, _admin_service  # noqa: PLW0603
    _admin_token = admin_token
    _health_registry = health_registry
    _collector = collector
    _apifootball = apifootball
    _admin_service = admin_service


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


def _check_admin(user: dict[str, str]) -> None:
    """Vérifie que l'utilisateur JWT a le rôle admin."""
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="admin required")


# ---------------------------------------------------------------------------
# Monitoring endpoints (Bearer admin token)
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
    """État du live engine."""
    _check_token(authorization)
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# User management endpoints (JWT admin required)
# ---------------------------------------------------------------------------


@router.get("/users")
async def admin_list_users(
    offset: int = 0,
    limit: int = 50,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    """Liste les utilisateurs (admin JWT requis)."""
    _check_admin(user)
    if _admin_service is None:
        raise HTTPException(status_code=503, detail="admin service not available")
    users = await _admin_service.list_users(offset=offset, limit=limit)
    count = await _admin_service.user_count()
    return {
        "users": [u.model_dump() for u in users],
        "total": count,
        "offset": offset,
        "limit": limit,
    }


@router.get("/users/{user_id}")
async def admin_get_user(
    user_id: str,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    """Détail d'un utilisateur."""
    _check_admin(user)
    if _admin_service is None:
        raise HTTPException(status_code=503, detail="admin service not available")
    target = await _admin_service.get_user(user_id)
    if target is None:
        raise HTTPException(status_code=404, detail="user not found")
    return target.model_dump()


class UserUpdateRequest(BaseModel):
    display_name: str | None = None
    locale: str | None = None
    timezone: str | None = None
    status: str | None = None
    role: str | None = None


@router.patch("/users/{user_id}")
async def admin_update_user(
    user_id: str,
    req: UserUpdateRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    """Met à jour un utilisateur."""
    _check_admin(user)
    if _admin_service is None:
        raise HTTPException(status_code=503, detail="admin service not available")
    fields = req.model_dump(exclude_none=True)
    updated = await _admin_service.update_user(user_id, **fields)
    if updated is None:
        raise HTTPException(status_code=404, detail="user not found")
    return updated.model_dump()


class BootstrapRequest(BaseModel):
    token: str
    email: str
    password: str


@router.post("/bootstrap")
async def admin_bootstrap(req: BootstrapRequest) -> dict[str, Any]:
    """Crée le premier admin via ADMIN_BOOTSTRAP_TOKEN. Pas d'auth requise."""
    if _admin_service is None:
        raise HTTPException(status_code=503, detail="admin service not available")
    admin_user = await _admin_service.bootstrap_admin(
        req.token, req.email, req.password,
    )
    if admin_user is None:
        raise HTTPException(status_code=403, detail="invalid bootstrap token")
    return {"status": "admin_created", "user": admin_user.model_dump()}
