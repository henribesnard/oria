"""Exporter — endpoints /metrics, /trace/{id}, /bottlenecks."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from fastapi import APIRouter

if TYPE_CHECKING:
    from oria.monitoring.collector import Collector

router = APIRouter()
_collector: Collector | None = None


def init_monitoring_routes(collector: Collector) -> None:
    global _collector  # noqa: PLW0603
    _collector = collector


@router.get("/metrics")
async def metrics() -> dict[str, Any]:
    if _collector is None:
        return {"error": "monitoring not available"}
    return _collector.get_metrics()


@router.get("/trace/{trace_id}")
async def trace(trace_id: str) -> dict[str, Any]:
    if _collector is None:
        return {"error": "monitoring not available"}
    record = _collector.get_trace(trace_id)
    if record is None:
        return {"error": "trace not found"}
    return {
        "trace_id": record.trace_id,
        "total_duration_ms": record.total_duration_ms,
        "spans": record.spans,
    }


@router.get("/bottlenecks")
async def bottlenecks() -> list[dict[str, Any]]:
    if _collector is None:
        return []
    return _collector.get_bottlenecks()
