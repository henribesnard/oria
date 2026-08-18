"""Tests feature flags — modules disabled si flag=false."""

from __future__ import annotations

from oria.config import Settings
from oria.kernel.health import Availability
from oria.main import build_container


class TestFeatureFlags:
    """P1: les flags enable_* doivent conditionner les modules optionnels."""

    def test_ingestion_disabled_by_default(self) -> None:
        """enable_ingestion=False → ingestion marqué DISABLED, pas UP."""
        settings = Settings(
            apifootball_key="",
            deepseek_api_key="",
            enable_llm=False,
            db_path=":memory:",
            enable_ingestion=False,
            enable_live=False,
            enable_push=False,
        )
        container, _ = build_container(settings)
        status = container.health.get("ingestion")
        assert status is not None
        assert status.availability == Availability.DISABLED

    def test_live_disabled_by_default(self) -> None:
        """enable_live=False → liveengine marqué DISABLED."""
        settings = Settings(
            apifootball_key="",
            deepseek_api_key="",
            enable_llm=False,
            db_path=":memory:",
            enable_live=False,
        )
        container, _ = build_container(settings)
        status = container.health.get("liveengine")
        assert status is not None
        assert status.availability == Availability.DISABLED

    def test_push_disabled_by_default(self) -> None:
        """enable_push=False → notifications marqué DISABLED."""
        settings = Settings(
            apifootball_key="",
            deepseek_api_key="",
            enable_llm=False,
            db_path=":memory:",
            enable_push=False,
        )
        container, _ = build_container(settings)
        status = container.health.get("notifications")
        assert status is not None
        assert status.availability == Availability.DISABLED

    def test_disabled_capabilities_not_available(self) -> None:
        """Capabilities de modules DISABLED ne sont pas annoncées comme disponibles."""
        settings = Settings(
            apifootball_key="",
            deepseek_api_key="",
            enable_llm=False,
            db_path=":memory:",
            enable_ingestion=False,
            enable_live=False,
            enable_push=False,
        )
        container, _ = build_container(settings)
        # Les capabilities des modules disabled ne doivent pas être UP
        assert not container.health.capability_available("prefetch")
        assert not container.health.capability_available("push")
