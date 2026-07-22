"""Gouverneur de quota API-Football.

Responsabilités :
- Budget journalier (remis à zéro à minuit UTC)
- Rate limit par minute
- Single-flight : coalesce les appels identiques concurrents
- Negative caching : mémorise les 404/204 pour éviter des appels inutiles
- Parse les en-têtes x-ratelimit-* pour ajuster le budget restant
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import time
from typing import Any

from oria.kernel.errors import QuotaExhaustedError

logger = logging.getLogger(__name__)

# Durée du negative cache (secondes)
_NEGATIVE_TTL = 300.0


class Governor:
    """Gère le budget, rate limit, single-flight et negative cache."""

    def __init__(self, *, daily_budget: int, rate_per_min: int) -> None:
        self._daily_budget = daily_budget
        self._rate_per_min = rate_per_min

        # Compteurs
        self._calls_today = 0
        self._day_marker = _today_marker()
        self._minute_calls: list[float] = []

        # Budget restant lu depuis les headers (optionnel, prioritaire)
        self._server_remaining: int | None = None

        # Single-flight : clé → Future en cours
        self._in_flight: dict[str, asyncio.Future[Any]] = {}

        # Negative cache : clé → expiration monotonic
        self._negative: dict[str, float] = {}

    # ------------------------------------------------------------------
    # Propriétés publiques
    # ------------------------------------------------------------------

    @property
    def remaining_budget(self) -> int:
        """Requêtes restantes aujourd'hui (estimation locale ou serveur)."""
        self._maybe_reset_day()
        if self._server_remaining is not None:
            return self._server_remaining
        return max(0, self._daily_budget - self._calls_today)

    @property
    def calls_today(self) -> int:
        self._maybe_reset_day()
        return self._calls_today

    # ------------------------------------------------------------------
    # Vérification pré-appel
    # ------------------------------------------------------------------

    def check_budget(self) -> None:
        """Lève QuotaExhaustedError si le budget est épuisé."""
        self._maybe_reset_day()
        if self.remaining_budget <= 0:
            raise QuotaExhaustedError(
                f"API-Football daily budget exhausted "
                f"({self._calls_today}/{self._daily_budget})"
            )

    def check_rate(self) -> None:
        """Lève QuotaExhaustedError si le rate par minute est dépassé."""
        now = time.monotonic()
        # Purger les appels > 60 s
        self._minute_calls = [t for t in self._minute_calls if now - t < 60.0]
        if len(self._minute_calls) >= self._rate_per_min:
            raise QuotaExhaustedError(
                f"API-Football rate limit reached "
                f"({self._rate_per_min}/min)"
            )

    # ------------------------------------------------------------------
    # Enregistrement post-appel
    # ------------------------------------------------------------------

    def record_call(self) -> None:
        """Enregistre un appel effectué."""
        self._maybe_reset_day()
        self._calls_today += 1
        self._minute_calls.append(time.monotonic())

    def update_from_headers(self, headers: dict[str, str]) -> None:
        """Met à jour le budget depuis les en-têtes de réponse."""
        # En-tête journalier (API-Sports)
        remaining = headers.get("x-ratelimit-requests-remaining")
        if remaining is not None:
            with contextlib.suppress(ValueError):
                self._server_remaining = int(remaining)

    # ------------------------------------------------------------------
    # Single-flight
    # ------------------------------------------------------------------

    def flight_key(self, endpoint: str, params: dict[str, Any] | None) -> str:
        """Construit une clé unique pour le coalescing."""
        parts = [endpoint]
        if params:
            parts.extend(f"{k}={v}" for k, v in sorted(params.items()))
        return "|".join(parts)

    def get_in_flight(self, key: str) -> asyncio.Future[Any] | None:
        """Renvoie le Future en cours pour cette clé, ou None."""
        fut = self._in_flight.get(key)
        if fut is not None and not fut.done():
            return fut
        # Nettoyer les futures terminées
        self._in_flight.pop(key, None)
        return None

    def register_flight(self, key: str) -> asyncio.Future[Any]:
        """Enregistre un nouveau vol et renvoie le Future associé."""
        loop = asyncio.get_running_loop()
        fut: asyncio.Future[Any] = loop.create_future()
        # Empêcher le warning "Future exception was never retrieved"
        # si personne d'autre n'attend ce future.
        fut.add_done_callback(_suppress_unhandled_exception)
        self._in_flight[key] = fut
        return fut

    def resolve_flight(self, key: str, result: Any) -> None:  # noqa: ANN401
        """Résout le Future single-flight avec le résultat."""
        fut = self._in_flight.pop(key, None)
        if fut is not None and not fut.done():
            fut.set_result(result)

    def reject_flight(self, key: str, exc: BaseException) -> None:
        """Rejette le Future single-flight avec l'erreur."""
        fut = self._in_flight.pop(key, None)
        if fut is not None and not fut.done():
            fut.set_exception(exc)

    # ------------------------------------------------------------------
    # Negative cache
    # ------------------------------------------------------------------

    def is_negative_cached(self, key: str) -> bool:
        """Vérifie si la clé est en negative cache."""
        exp = self._negative.get(key)
        if exp is None:
            return False
        if time.monotonic() > exp:
            del self._negative[key]
            return False
        return True

    def set_negative(self, key: str, ttl: float = _NEGATIVE_TTL) -> None:
        """Marque une clé comme negative-cachée."""
        self._negative[key] = time.monotonic() + ttl

    def clear_negative(self, key: str) -> None:
        """Retire une clé du negative cache."""
        self._negative.pop(key, None)

    # ------------------------------------------------------------------
    # Snapshot pour monitoring
    # ------------------------------------------------------------------

    def snapshot(self) -> dict[str, Any]:
        """Retourne l'état courant du governor pour le monitoring."""
        self._maybe_reset_day()
        now = time.monotonic()
        self._minute_calls = [t for t in self._minute_calls if now - t < 60.0]
        return {
            "daily_budget": self._daily_budget,
            "calls_today": self._calls_today,
            "remaining_budget": self.remaining_budget,
            "rate_per_min": self._rate_per_min,
            "calls_this_minute": len(self._minute_calls),
            "in_flight_count": sum(
                1 for f in self._in_flight.values() if not f.done()
            ),
            "negative_cache_size": len(self._negative),
        }

    # ------------------------------------------------------------------
    # Internes
    # ------------------------------------------------------------------

    def _maybe_reset_day(self) -> None:
        """Remet les compteurs à zéro si on a changé de jour UTC."""
        marker = _today_marker()
        if marker != self._day_marker:
            logger.info(
                "governor daily reset",
                extra={"old_calls": self._calls_today},
            )
            self._calls_today = 0
            self._server_remaining = None
            self._day_marker = marker


def _suppress_unhandled_exception(fut: asyncio.Future[Any]) -> None:
    """Callback : récupère l'exception pour éviter le warning asyncio."""
    if not fut.cancelled() and fut.exception() is not None:
        pass  # L'exception a déjà été gérée par l'appelant principal


def _today_marker() -> int:
    """Renvoie un entier unique par jour UTC (epoch // 86400)."""
    return int(time.time()) // 86400
