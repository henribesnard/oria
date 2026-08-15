"""Recorder — journal d'appels API-Football pour la campagne.

Instrumente ApiFootballClient.fetch via monkeypatch pour enregistrer
chaque appel réel sans modifier le code produit.
"""

from __future__ import annotations

import csv
import json
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


@dataclass
class ApiCallRecord:
    """Un appel API-Football enregistré."""

    ts_monotonic: float = 0.0
    ts_utc: float = 0.0
    endpoint: str = ""
    params: str = ""  # JSON-serialized, sorted
    latency_ms: float = 0.0
    http_status: int = 0
    errors: str = ""
    results: int = 0
    paging_current: int = 0
    paging_total: int = 0
    ratelimit_remaining: int = -1
    origin: str = "direct"  # prerouter | orchestrator | ingestion | liveengine | direct
    single_flight_join: bool = False
    trace_id: str = ""
    phase: str = ""


class Recorder:
    """Journal d'appels API — thread-safe grâce à l'event loop unique."""

    def __init__(self) -> None:
        self._calls: list[ApiCallRecord] = []
        self._phase: str = ""

    @property
    def calls(self) -> list[ApiCallRecord]:
        return self._calls

    @property
    def call_count(self) -> int:
        return len(self._calls)

    def set_phase(self, phase: str) -> None:
        self._phase = phase

    def record(self, call: ApiCallRecord) -> None:
        if not call.phase:
            call.phase = self._phase
        self._calls.append(call)

    def calls_in_phase(self, phase: str) -> list[ApiCallRecord]:
        return [c for c in self._calls if c.phase == phase]

    def real_calls(self, *, phase: str | None = None) -> list[ApiCallRecord]:
        """Appels réels (non-coalescés)."""
        calls = self._calls if phase is None else self.calls_in_phase(phase)
        return [c for c in calls if not c.single_flight_join]

    def coalesced_calls(self, *, phase: str | None = None) -> list[ApiCallRecord]:
        calls = self._calls if phase is None else self.calls_in_phase(phase)
        return [c for c in calls if c.single_flight_join]

    def calls_for_endpoint(self, endpoint: str) -> list[ApiCallRecord]:
        return [c for c in self._calls if c.endpoint == endpoint]

    def latest_remaining(self) -> int | None:
        """Dernier x-ratelimit-requests-remaining vu."""
        for call in reversed(self._calls):
            if call.ratelimit_remaining >= 0:
                return call.ratelimit_remaining
        return None

    def export_csv(self, path: Path) -> None:
        if not self._calls:
            return
        fields = list(asdict(self._calls[0]).keys())
        with path.open("w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fields)
            writer.writeheader()
            for call in self._calls:
                writer.writerow(asdict(call))

    def export_json(self, path: Path) -> None:
        data = [asdict(c) for c in self._calls]
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def summary(self) -> dict[str, Any]:
        real = self.real_calls()
        coalesced = self.coalesced_calls()
        by_endpoint: dict[str, int] = {}
        for c in real:
            by_endpoint[c.endpoint] = by_endpoint.get(c.endpoint, 0) + 1
        by_phase: dict[str, int] = {}
        for c in real:
            by_phase[c.phase] = by_phase.get(c.phase, 0) + 1
        latencies = [c.latency_ms for c in real if c.latency_ms > 0]
        return {
            "total_calls": len(self._calls),
            "real_calls": len(real),
            "coalesced": len(coalesced),
            "by_endpoint": by_endpoint,
            "by_phase": by_phase,
            "avg_latency_ms": sum(latencies) / len(latencies) if latencies else 0,
            "max_latency_ms": max(latencies) if latencies else 0,
        }


def install_recorder(
    client: Any,
    recorder: Recorder,
) -> None:
    """Monkeypatch ApiFootballClient.fetch pour enregistrer les appels.

    Ne modifie PAS le code produit — wrapping à la volée.
    """
    original_fetch = client.fetch

    async def patched_fetch(
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        flight_key = client._governor.flight_key(endpoint, params)

        # Détecter single-flight join
        is_join = client._governor.get_in_flight(flight_key) is not None
        # Détecter negative cache
        is_negative = client._governor.is_negative_cached(flight_key)

        t0 = time.monotonic()
        t0_utc = time.time()
        try:
            result = await original_fetch(endpoint, params)
        except Exception:
            # Enregistrer l'échec
            recorder.record(
                ApiCallRecord(
                    ts_monotonic=t0,
                    ts_utc=t0_utc,
                    endpoint=endpoint,
                    params=json.dumps(dict(sorted((params or {}).items())), ensure_ascii=False),
                    latency_ms=(time.monotonic() - t0) * 1000,
                    http_status=0,
                    errors="exception",
                    single_flight_join=is_join,
                )
            )
            raise

        latency = (time.monotonic() - t0) * 1000

        # Extraire les infos de la réponse
        errors = result.get("errors", [])
        errors_str = json.dumps(errors, ensure_ascii=False) if errors else ""
        results_count = result.get("results", 0)
        paging = result.get("paging", {})

        record = ApiCallRecord(
            ts_monotonic=t0,
            ts_utc=t0_utc,
            endpoint=endpoint,
            params=json.dumps(dict(sorted((params or {}).items())), ensure_ascii=False),
            latency_ms=latency,
            http_status=200 if not is_negative else 0,
            errors=errors_str,
            results=results_count,
            paging_current=paging.get("current", 0),
            paging_total=paging.get("total", 0),
            single_flight_join=is_join,
        )

        # Lire le ratelimit depuis le snapshot du governor
        if client._governor._server_remaining is not None:
            record.ratelimit_remaining = client._governor._server_remaining

        recorder.record(record)
        return result

    client.fetch = patched_fetch
