"""Tests de boot — démarrage tolérant."""

from __future__ import annotations

from typing import TYPE_CHECKING

import pytest

from oria.container import Container
from oria.kernel.health import Availability

if TYPE_CHECKING:
    from oria.config import Settings

from .conftest import FakeModule


class TestBoot:
    async def test_boot_with_optional_modules_down(self, settings: Settings) -> None:
        container = Container(settings=settings)
        container.add(FakeModule("required_ok", required=True))
        container.add(FakeModule("optional_fail", required=False, fail_start=True))
        container.add(FakeModule("optional_ok", required=False))

        await container.start_all()

        snap = container.health.snapshot()
        assert snap["required_ok"].availability == Availability.UP
        assert snap["optional_fail"].availability == Availability.DOWN
        assert snap["optional_ok"].availability == Availability.UP

        await container.stop_all()

    async def test_boot_aborts_on_required_failure(self, settings: Settings) -> None:
        container = Container(settings=settings)
        container.add(FakeModule("critical", required=True, fail_start=True))

        with pytest.raises(RuntimeError, match="critical start failed"):
            await container.start_all()

    async def test_capabilities_registered(self, settings: Settings) -> None:
        container = Container(settings=settings)
        container.add(FakeModule("live", provides=("live_scores",)))

        await container.start_all()

        assert container.health.capability_available("live_scores")
        assert not container.health.capability_available("nonexistent")

        await container.stop_all()
