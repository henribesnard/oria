"""Collecteur de traces — s'abonne au bus, assemble les spans, détecte les goulots."""

from __future__ import annotations

import logging
import time
from collections import deque
from typing import Any

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class TraceRecord:
    """Trace assemblée = arbre de spans pour un request_id."""

    def __init__(self, trace_id: str) -> None:
        self.trace_id = trace_id
        self.spans: list[dict[str, Any]] = []
        self.started_at = time.monotonic()

    @property
    def total_duration_ms(self) -> float:
        if not self.spans:
            return 0.0
        return sum(s.get("duration_ms", 0) or 0 for s in self.spans)


class Collector:
    """Module optionnel : traçage + métriques + détection de goulots."""

    name: str = "monitoring"
    required: bool = False
    provides: tuple[str, ...] = ("monitoring",)

    def __init__(self, *, buffer_size: int = 500, stage_budget_ms: float = 1500.0) -> None:
        self._buffer_size = buffer_size
        self._stage_budget_ms = stage_budget_ms
        self._traces: dict[str, TraceRecord] = {}
        self._recent: deque[TraceRecord] = deque(maxlen=buffer_size)
        self._aggregates: dict[str, _Aggregate] = {}
        self._bottlenecks: list[dict[str, Any]] = []

    async def start(self) -> None:
        logger.info("monitoring collector ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def handle_span(self, span_data: Any) -> None:  # noqa: ANN401
        """Handler du bus : reçoit un span, l'assemble dans la trace."""
        if not isinstance(span_data, dict):
            return

        trace_id = span_data.get("trace_id", "")
        if trace_id not in self._traces:
            self._traces[trace_id] = TraceRecord(trace_id)

        record = self._traces[trace_id]
        record.spans.append(span_data)

        # Agrégats glissants
        name = span_data.get("name", "unknown")
        duration = span_data.get("duration_ms") or 0.0
        agg = self._aggregates.setdefault(name, _Aggregate(name))
        agg.record(duration)

        # Détection de goulot
        if duration > self._stage_budget_ms:
            self._bottlenecks.append(
                {
                    "name": name,
                    "duration_ms": duration,
                    "trace_id": trace_id,
                    "detected_at": time.time(),
                }
            )
            # Borner la liste
            if len(self._bottlenecks) > 100:
                self._bottlenecks = self._bottlenecks[-100:]

    def finalize_trace(self, trace_id: str) -> None:
        """Déplace une trace dans le ring buffer."""
        record = self._traces.pop(trace_id, None)
        if record:
            self._recent.append(record)

    def get_trace(self, trace_id: str) -> TraceRecord | None:
        # Chercher dans les en-cours puis le ring buffer
        if trace_id in self._traces:
            return self._traces[trace_id]
        for record in self._recent:
            if record.trace_id == trace_id:
                return record
        return None

    def get_metrics(self) -> dict[str, Any]:
        return {name: agg.to_dict() for name, agg in self._aggregates.items()}

    def get_bottlenecks(self) -> list[dict[str, Any]]:
        return list(self._bottlenecks)


class _Aggregate:
    """Agrégat glissant par (module, action)."""

    def __init__(self, name: str) -> None:
        self.name = name
        self.count = 0
        self.total_ms = 0.0
        self.max_ms = 0.0
        self._values: deque[float] = deque(maxlen=1000)

    def record(self, duration_ms: float) -> None:
        self.count += 1
        self.total_ms += duration_ms
        self.max_ms = max(self.max_ms, duration_ms)
        self._values.append(duration_ms)

    @property
    def p50(self) -> float:
        return self._percentile(0.5)

    @property
    def p95(self) -> float:
        return self._percentile(0.95)

    @property
    def p99(self) -> float:
        return self._percentile(0.99)

    def _percentile(self, p: float) -> float:
        if not self._values:
            return 0.0
        sorted_vals = sorted(self._values)
        idx = int(len(sorted_vals) * p)
        idx = min(idx, len(sorted_vals) - 1)
        return sorted_vals[idx]

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "count": self.count,
            "avg_ms": self.total_ms / self.count if self.count else 0,
            "p50_ms": self.p50,
            "p95_ms": self.p95,
            "p99_ms": self.p99,
            "max_ms": self.max_ms,
        }
