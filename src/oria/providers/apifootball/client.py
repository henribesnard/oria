"""Client unique API-Football — seul point httpx du projet.

Auth + base URL lus depuis Settings selon APIFOOTBALL_AUTH_MODE.
Chaque appel passe par @resilient et émet un span apifootball.fetch.
Le Governor gère le budget, le rate limit et le single-flight.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import httpx

from oria.kernel.errors import ProviderError, UpstreamError
from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.resilience import resilient
from oria.kernel.tracing import span
from oria.providers.apifootball.governor import Governor

if TYPE_CHECKING:
    from oria.config import Settings

logger = logging.getLogger(__name__)

# RapidAPI host constant
_RAPIDAPI_HOST = "api-football-v1.p.rapidapi.com"


class ApiFootballClient:
    """Module optionnel : point d'entrée unique API-Football."""

    name: str = "apifootball"
    required: bool = False
    provides: tuple[str, ...] = ("football_data",)

    def __init__(self, *, settings: Settings) -> None:
        self._api_key = settings.apifootball_key
        self._base_url = settings.apifootball_base_url.rstrip("/")
        self._auth_mode = settings.apifootball_auth_mode
        self._timeout = settings.default_timeout_seconds
        self._governor = Governor(
            daily_budget=settings.apifootball_daily_budget,
            rate_per_min=settings.apifootball_rate_per_min,
        )
        self._client: httpx.AsyncClient | None = None
        self._available = False

    @property
    def governor(self) -> Governor:
        """Accès au governor pour le monitoring."""
        return self._governor

    async def start(self) -> None:
        if not self._api_key:
            raise ProviderError("APIFOOTBALL_KEY not configured")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers=self._build_auth_headers(),
            timeout=httpx.Timeout(self._timeout),
        )
        self._available = True
        logger.info(
            "apifootball client ready",
            extra={"auth_mode": self._auth_mode, "base_url": self._base_url},
        )

    async def stop(self) -> None:
        self._available = False
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def health(self) -> ModuleStatus:
        avail = Availability.UP if self._available else Availability.DOWN
        details: dict[str, Any] = {}
        if self._available:
            details["remaining_budget"] = self._governor.remaining_budget
            details["calls_today"] = self._governor.calls_today
        return ModuleStatus(
            name=self.name, availability=avail, details=details,
        )

    async def fetch(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Appel API-Football avec governor, single-flight, @resilient et span.

        Args:
            endpoint: chemin relatif (ex: "/fixtures", "/standings")
            params: paramètres de requête

        Returns:
            Le corps JSON complet de la réponse API-Football.
        """
        if self._client is None:
            raise ProviderError("apifootball client not started")

        # Construire la clé pour single-flight et negative cache
        flight_key = self._governor.flight_key(endpoint, params)

        # Negative cache : pas d'appel si on sait déjà que c'est vide
        if self._governor.is_negative_cached(flight_key):
            logger.debug(
                "negative cache hit",
                extra={"endpoint": endpoint},
            )
            return {"response": [], "results": 0}

        # Single-flight : réutiliser un appel identique en cours
        existing = self._governor.get_in_flight(flight_key)
        if existing is not None:
            logger.debug(
                "single-flight coalesce",
                extra={"endpoint": endpoint},
            )
            result: dict[str, Any] = await existing
            return result

        # Vérifier le budget et le rate limit
        self._governor.check_budget()
        self._governor.check_rate()

        # Enregistrer le vol pour coalescing
        self._governor.register_flight(flight_key)

        try:
            data: dict[str, Any] = await self._do_fetch(endpoint, params or {})
            self._governor.resolve_flight(flight_key, data)
            return data
        except BaseException as exc:
            self._governor.reject_flight(flight_key, exc)
            raise

    @resilient(
        timeout=10.0,
        retries=2,
        breaker="apifootball",
        fail_max=5,
        reset_timeout=30.0,
    )
    async def _do_fetch(
        self,
        endpoint: str,
        params: dict[str, Any],
    ) -> dict[str, Any]:
        """Appel HTTP réel, instrumenté par span et protégé par @resilient."""
        assert self._client is not None  # noqa: S101

        async with span(
            "apifootball.fetch",
            attrs={"endpoint": endpoint, "params": params},
        ) as s:
            response = await self._client.get(endpoint, params=params)

            # Enregistrer l'appel et mettre à jour le budget
            self._governor.record_call()
            self._governor.update_from_headers(
                dict(response.headers),
            )

            s.attrs["status_code"] = response.status_code

            # Gérer les erreurs HTTP
            if response.status_code == 429:
                raise UpstreamError(
                    f"API-Football rate limited (429) on {endpoint}"
                )

            if response.status_code >= 400:
                raise UpstreamError(
                    f"API-Football error {response.status_code} "
                    f"on {endpoint}"
                )

            data: dict[str, Any] = response.json()

            # Vérifier les erreurs logiques API-Football
            # (code HTTP 200 mais erreur dans le body)
            errors = data.get("errors")
            if errors:
                # errors peut être un dict non-vide ou une liste non-vide
                has_errors = (
                    (isinstance(errors, dict) and len(errors) > 0)
                    or (isinstance(errors, list) and len(errors) > 0)
                )
                if has_errors:
                    raise UpstreamError(
                        f"API-Football logical error on {endpoint}: "
                        f"{errors}"
                    )

            # Negative cache : si la réponse est vide, on la mémorise
            results = data.get("results", 0)
            if results == 0:
                flight_key = self._governor.flight_key(endpoint, params)
                self._governor.set_negative(flight_key)

            s.attrs["results"] = results
            return data

    def _build_auth_headers(self) -> dict[str, str]:
        """Construit les headers d'auth selon le mode configuré."""
        if self._auth_mode == "rapidapi":
            return {
                "x-rapidapi-key": self._api_key,
                "x-rapidapi-host": _RAPIDAPI_HOST,
            }
        # Mode direct (défaut)
        return {"x-apisports-key": self._api_key}
