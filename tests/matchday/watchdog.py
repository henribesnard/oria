"""Watchdog -- surveillance continue pendant le run.

Interroge /admin/quota et /health periodiquement,
logue les alertes en cas de franchissement de seuil.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

BASE_URL = "http://localhost:8000"

# Seuils d'alerte
QUOTA_CRITICAL = 1500  # appels restants
QUOTA_WARNING = 3000


class Watchdog:
    """Surveille le systeme pendant le run."""

    def __init__(
        self,
        admin_token: str,
        logs_dir: Path,
        poll_interval: float = 30.0,
    ) -> None:
        self._admin_token = admin_token
        self._logs_dir = logs_dir
        self._poll_interval = poll_interval
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self._alerts: list[dict[str, Any]] = []
        self._snapshots: list[dict[str, Any]] = []

    @property
    def alerts(self) -> list[dict[str, Any]]:
        return self._alerts

    async def start(self) -> None:
        """Demarre la surveillance en tache de fond."""
        self._running = True
        self._logs_dir.mkdir(parents=True, exist_ok=True)
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("watchdog started (interval=%.0fs)", self._poll_interval)

    async def stop(self) -> None:
        """Arrete la surveillance."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._export()
        logger.info("watchdog stopped (%d alerts)", len(self._alerts))

    async def _poll_loop(self) -> None:
        """Boucle de polling."""
        async with httpx.AsyncClient() as client:
            while self._running:
                try:
                    await self._check_once(client)
                except Exception as e:
                    logger.error("watchdog poll error: %s", e)
                await asyncio.sleep(self._poll_interval)

    async def _check_once(self, client: httpx.AsyncClient) -> None:
        """Un cycle de verification."""
        ts = datetime.now(tz=UTC).isoformat(timespec="milliseconds")
        snapshot: dict[str, Any] = {"ts": ts}

        # Quota
        try:
            resp = await client.get(
                f"{BASE_URL}/admin/quota",
                headers={"Authorization": f"Bearer {self._admin_token}"},
                timeout=5.0,
            )
            if resp.status_code == 200:
                quota = resp.json()
                snapshot["quota"] = quota
                remaining = quota.get("remaining_budget", 9999)

                if remaining < QUOTA_CRITICAL:
                    self._alert("CRITICAL", "quota", f"Quota critique: {remaining} restants", ts)
                elif remaining < QUOTA_WARNING:
                    self._alert("WARNING", "quota", f"Quota bas: {remaining} restants", ts)
        except Exception as e:
            self._alert("ERROR", "quota_check", f"Impossible de lire le quota: {e}", ts)

        # Health
        try:
            resp = await client.get(f"{BASE_URL}/health", timeout=5.0)
            if resp.status_code == 200:
                health = resp.json()
                snapshot["health_status"] = health.get("status", "unknown")

                # Verifier les modules down
                modules = health.get("modules", {})
                for name, info in modules.items():
                    if info.get("availability") != "up":
                        self._alert(
                            "WARNING", "module_down",
                            f"Module {name} is {info.get('availability', 'unknown')}", ts,
                        )
            else:
                self._alert("ERROR", "health_check", f"Health returned {resp.status_code}", ts)
        except Exception as e:
            self._alert("CRITICAL", "server_down", f"Serveur injoignable: {e}", ts)

        self._snapshots.append(snapshot)

    def _alert(self, severity: str, category: str, message: str, ts: str) -> None:
        """Enregistre une alerte."""
        alert = {
            "ts": ts,
            "severity": severity,
            "category": category,
            "message": message,
        }
        self._alerts.append(alert)
        log_fn = logger.critical if severity == "CRITICAL" else (
            logger.warning if severity == "WARNING" else logger.error
        )
        log_fn("WATCHDOG [%s] %s: %s", severity, category, message)

    def check_sync(self) -> dict[str, Any]:
        """Verification synchrone (sans polling)."""
        return {
            "alerts_count": len(self._alerts),
            "snapshots_count": len(self._snapshots),
            "last_snapshot": self._snapshots[-1] if self._snapshots else None,
        }

    def _export(self) -> None:
        """Exporte les alertes et snapshots."""
        if self._alerts:
            (self._logs_dir / "watchdog_alerts.json").write_text(
                json.dumps(self._alerts, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
        if self._snapshots:
            (self._logs_dir / "watchdog_snapshots.json").write_text(
                json.dumps(self._snapshots, indent=2, ensure_ascii=False),
                encoding="utf-8",
            )
