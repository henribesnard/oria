"""Primitives de résilience — circuit breaker, @resilient, guard, Supervisor."""

from __future__ import annotations

import asyncio
import logging
import time
from contextlib import asynccontextmanager
from enum import StrEnum
from functools import wraps
from typing import TYPE_CHECKING, Any, TypeVar

if TYPE_CHECKING:
    from collections.abc import Callable, Coroutine

from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from oria.kernel.errors import CircuitOpenError

logger = logging.getLogger(__name__)

T = TypeVar("T")


# ---------------------------------------------------------------------------
# 1) Circuit Breaker
# ---------------------------------------------------------------------------


class _BreakerState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


class CircuitBreaker:
    """Circuit breaker par dépendance externe."""

    def __init__(
        self,
        name: str,
        *,
        fail_max: int = 5,
        reset_timeout: float = 30.0,
    ) -> None:
        self.name = name
        self._fail_max = fail_max
        self._reset_timeout = reset_timeout
        self._state = _BreakerState.CLOSED
        self._fail_count = 0
        self._opened_at = 0.0

    @property
    def state(self) -> str:
        self._maybe_half_open()
        return self._state.value

    def _maybe_half_open(self) -> None:
        if (
            self._state == _BreakerState.OPEN
            and time.monotonic() - self._opened_at >= self._reset_timeout
        ):
            self._state = _BreakerState.HALF_OPEN

    async def call(
        self,
        coro_fn: Callable[..., Coroutine[Any, Any, T]],
        *args: Any,
        **kwargs: Any,
    ) -> T:
        """Exécute coro_fn à travers le breaker."""
        self._maybe_half_open()

        if self._state == _BreakerState.OPEN:
            raise CircuitOpenError(f"circuit '{self.name}' is open")

        try:
            result = await coro_fn(*args, **kwargs)
        except Exception as exc:
            self._record_failure()
            raise exc
        else:
            self._record_success()
            return result

    def _record_failure(self) -> None:
        self._fail_count += 1
        if self._fail_count >= self._fail_max:
            self._state = _BreakerState.OPEN
            self._opened_at = time.monotonic()
            logger.warning("circuit breaker opened", extra={"breaker": self.name})

    def _record_success(self) -> None:
        if self._state == _BreakerState.HALF_OPEN:
            logger.info("circuit breaker closed", extra={"breaker": self.name})
        self._fail_count = 0
        self._state = _BreakerState.CLOSED


# Registre global des breakers (un par dépendance)
_breakers: dict[str, CircuitBreaker] = {}


def get_breaker(
    name: str,
    *,
    fail_max: int = 5,
    reset_timeout: float = 30.0,
) -> CircuitBreaker:
    if name not in _breakers:
        _breakers[name] = CircuitBreaker(name, fail_max=fail_max, reset_timeout=reset_timeout)
    return _breakers[name]


# ---------------------------------------------------------------------------
# 2) @resilient — décorateur composite
# ---------------------------------------------------------------------------


def resilient(
    *,
    timeout: float,
    retries: int = 2,
    breaker: str | None = None,
    fallback: Callable[..., Any] | None = None,
    fail_max: int = 5,
    reset_timeout: float = 30.0,
) -> Callable[..., Any]:
    """Timeout → retry (backoff borné) → circuit breaker → fallback."""

    def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
        # Retry via tenacity (sur toute exception sauf CircuitOpenError)
        retried = retry(
            stop=stop_after_attempt(retries + 1),
            wait=wait_exponential(multiplier=0.5, max=4),
            retry=retry_if_exception_type(Exception),
            reraise=True,
        )(fn)

        @wraps(fn)
        async def wrapper(*args: Any, **kwargs: Any) -> Any:  # noqa: ANN401
            cb = (
                get_breaker(breaker, fail_max=fail_max, reset_timeout=reset_timeout)
                if breaker
                else None
            )

            async def _attempt() -> Any:  # noqa: ANN401
                return await asyncio.wait_for(retried(*args, **kwargs), timeout=timeout)

            try:
                if cb is not None:
                    return await cb.call(_attempt)
                return await _attempt()
            except Exception:
                if fallback is not None:
                    logger.warning(
                        "resilient fallback triggered",
                        extra={"function": fn.__name__},
                        exc_info=True,
                    )
                    result = fallback(*args, **kwargs)
                    if asyncio.iscoroutine(result):
                        return await result
                    return result
                raise

        return wrapper

    return decorator


# ---------------------------------------------------------------------------
# 3) guard — contexte de stage de pipeline
# ---------------------------------------------------------------------------


@asynccontextmanager
async def guard(
    stage: str,
    *,
    on_error: Any = None,
) -> Any:  # noqa: ANN401
    """Capture les exceptions d'un stage, renvoie la valeur dégradée."""
    try:
        yield
    except Exception:
        logger.exception("stage failed — degrading", extra={"stage": stage})
        if callable(on_error):
            result = on_error()
            if asyncio.iscoroutine(result):
                await result


# ---------------------------------------------------------------------------
# 4) Supervisor — tâches de fond isolées
# ---------------------------------------------------------------------------


class Supervisor:
    """Supervise des tâches asyncio : relance avec backoff en cas de crash."""

    def __init__(self) -> None:
        self._tasks: dict[str, asyncio.Task[None]] = {}
        self._factories: dict[str, Callable[[], Coroutine[Any, Any, None]]] = {}
        self._restart_flags: dict[str, bool] = {}
        self._running = True

    def spawn(
        self,
        name: str,
        coro_factory: Callable[[], Coroutine[Any, Any, None]],
        *,
        restart: bool = True,
    ) -> None:
        """Lance une tâche supervisée."""
        self._factories[name] = coro_factory
        self._restart_flags[name] = restart
        task = asyncio.create_task(self._run(name), name=f"supervisor-{name}")
        self._tasks[name] = task

    async def _run(self, name: str) -> None:
        backoff = 1.0
        while self._running:
            try:
                await self._factories[name]()
                break  # terminaison normale
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("supervised task crashed", extra={"task": name})
                if not self._restart_flags.get(name, False) or not self._running:
                    break
                logger.info(
                    "restarting task after backoff",
                    extra={"task": name, "backoff": backoff},
                )
                await asyncio.sleep(backoff)
                backoff = min(backoff * 2, 60.0)

    async def stop_all(self) -> None:
        """Arrête toutes les tâches supervisées."""
        self._running = False
        for task in self._tasks.values():
            task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks.values(), return_exceptions=True)
        self._tasks.clear()
