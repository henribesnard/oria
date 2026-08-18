"""Harness — métriques, budget guard, probe, latences, réconciliation."""

from __future__ import annotations

import logging
import math
import time
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

from oria.kernel.models import Context, IncomingRequest, Response

if TYPE_CHECKING:
    from oria.core.pipeline import Pipeline
    from tests.campaign.recorder import Recorder

logger = logging.getLogger(__name__)

# Seuil minimal de budget pour démarrer une phase
_MIN_RESERVE = 500


class PhaseBudgetExceeded(Exception):
    """Le budget alloué à la phase a été dépassé."""


class InsufficientBudget(Exception):
    """Budget restant insuffisant pour lancer cette phase."""


@dataclass
class ProbeResult:
    """Résultat d'une question envoyée via Probe.ask."""

    response: Response
    latency_ms: float
    api_calls_delta: int
    route: str
    degraded: bool
    attachment_kinds: list[str]
    trace_id: str = ""


class BudgetGuard:
    """Context manager de budget par phase.

    Compte les appels réels, lève PhaseBudgetExceeded au dépassement.
    """

    def __init__(
        self,
        phase_name: str,
        max_calls: int,
        recorder: Recorder,
        governor: Any,
    ) -> None:
        self.phase_name = phase_name
        self.max_calls = max_calls
        self._recorder = recorder
        self._governor = governor
        self._calls_at_start = 0

    @property
    def calls_used(self) -> int:
        return len(self._recorder.real_calls(phase=self.phase_name))

    @property
    def remaining(self) -> int:
        return self.max_calls - self.calls_used

    async def __aenter__(self) -> BudgetGuard:
        self._calls_at_start = self._governor.calls_today
        self._recorder.set_phase(self.phase_name)

        # Vérifier le budget restant
        budget_remaining = self._governor.remaining_budget
        if budget_remaining < self.max_calls + _MIN_RESERVE:
            raise InsufficientBudget(
                f"Phase {self.phase_name}: besoin de {self.max_calls}+{_MIN_RESERVE} "
                f"appels, mais seulement {budget_remaining} restants"
            )

        logger.info(
            "phase %s started — budget: %d/%d, governor remaining: %d",
            self.phase_name,
            0,
            self.max_calls,
            budget_remaining,
        )
        return self

    async def __aexit__(self, *args: object) -> None:
        calls_total = self.calls_used
        logger.info(
            "phase %s ended — %d/%d calls used",
            self.phase_name,
            calls_total,
            self.max_calls,
        )

    def check(self) -> None:
        """Vérification inline — lever si budget de phase dépassé."""
        if self.calls_used >= self.max_calls:
            raise PhaseBudgetExceeded(
                f"Phase {self.phase_name}: budget épuisé ({self.calls_used}/{self.max_calls})"
            )

        # Vérifier aussi la réserve globale
        remaining = self._governor.remaining_budget
        if remaining < _MIN_RESERVE:
            raise PhaseBudgetExceeded(
                f"Phase {self.phase_name}: réserve globale critique ({remaining} < {_MIN_RESERVE})"
            )


class Probe:
    """Envoie une question dans le pipeline et collecte les métriques."""

    def __init__(
        self,
        pipeline: Pipeline,
        governor: Any,
    ) -> None:
        self._pipeline = pipeline
        self._governor = governor

    async def ask(
        self,
        question: str,
        context: Context | None = None,
        *,
        user_id: str = "campaign-probe",
    ) -> ProbeResult:
        req = IncomingRequest(
            user_id=user_id,
            text=question,
            context=context or Context(),
            locale="fr",
        )
        calls_before = self._governor.calls_today
        t0 = time.perf_counter()
        resp = await self._pipeline.handle_message(req)
        latency = (time.perf_counter() - t0) * 1000
        calls_after = self._governor.calls_today

        route = _detect_route(resp)
        return ProbeResult(
            response=resp,
            latency_ms=latency,
            api_calls_delta=calls_after - calls_before,
            route=route,
            degraded=resp.degraded,
            attachment_kinds=[a.kind for a in resp.attachments],
        )


def _detect_route(resp: Response) -> str:
    """Détecte la route empruntée d'après la réponse."""
    text = resp.text.lower()
    if "salut" in text and "oria" in text:
        return "prerouter:salutation"
    if "aider avec" in text or ("aide" in text and "classement" in text):
        return "prerouter:aide"
    if resp.attachments:
        kinds = [a.kind for a in resp.attachments]
        if "table" in kinds:
            for a in resp.attachments:
                data_str = str(a.data)
                if "standings" in data_str:
                    return "prerouter:classement"
                if "form" in data_str:
                    return "prerouter:forme"
                if "schedule" in data_str:
                    return "prerouter:calendrier"
                if "injuries" in data_str:
                    return "prerouter:blessures"
                if "players" in data_str:
                    return "prerouter:joueurs"
                if "team" in data_str:
                    return "prerouter:equipe"
                if "live" in data_str:
                    return "prerouter:live"
                if "odds" in data_str:
                    return "prerouter:cotes"
            return "prerouter:outil"
        if "fixture_card" in kinds:
            return "prerouter:fixture"
        return "prerouter:outil"
    if "pas pu traiter" in text or "reformuler" in text:
        return "fallback"
    if resp.degraded:
        return "fallback:degrade"
    return "orchestrator"


class Latencies:
    """Accumulateur de latences avec percentiles."""

    def __init__(self) -> None:
        self._values: list[float] = []
        self._by_category: dict[str, list[float]] = {}

    def record(self, value: float, category: str = "") -> None:
        self._values.append(value)
        if category:
            self._by_category.setdefault(category, []).append(value)

    def percentile(self, p: float, values: list[float] | None = None) -> float:
        vals = sorted(values or self._values)
        if not vals:
            return 0.0
        k = (len(vals) - 1) * p / 100
        f = math.floor(k)
        c = math.ceil(k)
        if f == c:
            return vals[int(k)]
        d = k - f
        return vals[f] * (1 - d) + vals[c] * d

    def stats(self, values: list[float] | None = None) -> dict[str, float]:
        vals = values or self._values
        if not vals:
            return {"count": 0, "p50": 0, "p90": 0, "p95": 0, "p99": 0, "max": 0, "avg": 0}
        return {
            "count": len(vals),
            "p50": self.percentile(50, vals),
            "p90": self.percentile(90, vals),
            "p95": self.percentile(95, vals),
            "p99": self.percentile(99, vals),
            "max": max(vals),
            "avg": sum(vals) / len(vals),
        }

    def stats_by_category(self) -> dict[str, dict[str, float]]:
        return {cat: self.stats(vals) for cat, vals in self._by_category.items()}

    def global_stats(self) -> dict[str, float]:
        return self.stats()


def reconcile_quota(
    governor: Any,
    recorder: Recorder,
    phase: str | None = None,
) -> dict[str, Any]:
    """Réconciliation 3 sources : governor local, recorder, header serveur.

    Les trois doivent coïncider à ±2.
    """
    governor_calls = governor.calls_today
    recorder_real = len(recorder.real_calls(phase=phase))
    server_remaining = recorder.latest_remaining()

    result: dict[str, Any] = {
        "governor_calls_today": governor_calls,
        "recorder_real_calls": recorder_real,
        "server_remaining": server_remaining,
        "anomalies": [],
    }

    # Si on a le header serveur, comparer
    if server_remaining is not None:
        budget = governor._daily_budget
        server_used = budget - server_remaining
        result["server_used_estimate"] = server_used

        # Governor vs serveur
        diff_gov_srv = abs(governor_calls - server_used)
        if diff_gov_srv > 2:
            result["anomalies"].append(
                f"ÉCART governor/serveur: governor={governor_calls}, "
                f"serveur_estimé={server_used} (Δ={diff_gov_srv})"
            )

    return result
