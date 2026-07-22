"""Tests unitaires des primitives de résilience."""

from __future__ import annotations

import asyncio

import pytest

from oria.kernel.errors import CircuitOpenError
from oria.kernel.resilience import CircuitBreaker, Supervisor, guard, resilient

# ---------------------------------------------------------------------------
# CircuitBreaker
# ---------------------------------------------------------------------------


class TestCircuitBreaker:
    async def test_closed_passes_through(self) -> None:
        cb = CircuitBreaker("test", fail_max=3)

        async def ok() -> str:
            return "ok"

        result = await cb.call(ok)
        assert result == "ok"
        assert cb.state == "closed"

    async def test_opens_after_fail_max(self) -> None:
        cb = CircuitBreaker("test", fail_max=3)

        async def fail() -> None:
            raise ValueError("boom")

        for _ in range(3):
            with pytest.raises(ValueError):
                await cb.call(fail)

        assert cb.state == "open"
        with pytest.raises(CircuitOpenError):
            await cb.call(fail)

    async def test_half_open_after_timeout(self) -> None:
        cb = CircuitBreaker("test", fail_max=1, reset_timeout=0.05)

        async def fail() -> None:
            raise ValueError("boom")

        with pytest.raises(ValueError):
            await cb.call(fail)

        # Juste après l'ouverture, le breaker est OPEN
        assert cb._state.value == "open"  # noqa: SLF001
        # Après le cooldown, il passe en half_open
        await asyncio.sleep(0.1)
        assert cb.state == "half_open"

    async def test_half_open_success_closes(self) -> None:
        cb = CircuitBreaker("test", fail_max=1, reset_timeout=0.0)

        async def fail() -> None:
            raise ValueError("boom")

        async def ok() -> str:
            return "recovered"

        with pytest.raises(ValueError):
            await cb.call(fail)

        await asyncio.sleep(0.01)
        result = await cb.call(ok)
        assert result == "recovered"
        assert cb.state == "closed"


# ---------------------------------------------------------------------------
# @resilient
# ---------------------------------------------------------------------------


class TestResilient:
    async def test_timeout(self) -> None:
        @resilient(timeout=0.05, retries=0)
        async def slow() -> None:
            await asyncio.sleep(10)

        with pytest.raises(asyncio.TimeoutError):
            await slow()

    async def test_fallback(self) -> None:
        @resilient(timeout=1.0, retries=0, fallback=lambda: "fallback_value")
        async def fail() -> str:
            raise ValueError("boom")

        result = await fail()
        assert result == "fallback_value"

    async def test_breaker_integration(self) -> None:
        call_count = 0

        @resilient(timeout=1.0, retries=0, breaker="test_res", fail_max=2, reset_timeout=60.0)
        async def fail() -> None:
            nonlocal call_count
            call_count += 1
            raise ValueError("boom")

        # 2 échecs → breaker ouvre
        for _ in range(2):
            with pytest.raises(ValueError):
                await fail()

        # Le 3e ne part plus vers la fonction
        with pytest.raises(CircuitOpenError):
            await fail()
        assert call_count == 2  # pas appelé la 3e fois


# ---------------------------------------------------------------------------
# guard
# ---------------------------------------------------------------------------


class TestGuard:
    async def test_guard_catches_exception(self) -> None:
        result = "initial"

        async with guard("test_stage", on_error=lambda: None):
            raise ValueError("boom")

        # On arrive ici sans exception
        assert result == "initial"

    async def test_guard_passes_through(self) -> None:
        async with guard("test_stage", on_error=lambda: None):
            pass  # pas d'erreur


# ---------------------------------------------------------------------------
# Supervisor
# ---------------------------------------------------------------------------


class TestSupervisor:
    async def test_spawn_and_stop(self) -> None:
        started = False

        async def task() -> None:
            nonlocal started
            started = True
            await asyncio.sleep(100)

        sup = Supervisor()
        sup.spawn("t", task)
        await asyncio.sleep(0.05)
        assert started

        await sup.stop_all()

    async def test_restart_on_crash(self) -> None:
        call_count = 0

        async def crasher() -> None:
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise RuntimeError("crash")
            await asyncio.sleep(100)  # stable à la 3e

        sup = Supervisor()
        sup.spawn("crasher", crasher, restart=True)
        # Attendre assez pour quelques relances (backoff = 1s, 2s)
        await asyncio.sleep(4)
        assert call_count >= 3

        await sup.stop_all()
