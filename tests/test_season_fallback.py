"""Tests C-04 — repli saison : le prompt système contient date/saison et instructions de repli."""

from __future__ import annotations

from datetime import date
from unittest.mock import patch

import pytest

from oria.core.orchestrator import (
    _build_system_prompt,
    _current_football_season,
)


class TestCurrentFootballSeason:
    """_current_football_season suit la convention juillet→nouvelle saison."""

    def test_august_returns_current_year(self) -> None:
        with patch("oria.core.orchestrator.date") as mock_date:
            mock_date.today.return_value = date(2025, 8, 15)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            assert _current_football_season() == 2025

    def test_january_returns_previous_year(self) -> None:
        with patch("oria.core.orchestrator.date") as mock_date:
            mock_date.today.return_value = date(2026, 1, 10)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            assert _current_football_season() == 2025

    def test_june_returns_previous_year(self) -> None:
        with patch("oria.core.orchestrator.date") as mock_date:
            mock_date.today.return_value = date(2026, 6, 30)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            assert _current_football_season() == 2025

    def test_july_returns_current_year(self) -> None:
        with patch("oria.core.orchestrator.date") as mock_date:
            mock_date.today.return_value = date(2026, 7, 1)
            mock_date.side_effect = lambda *a, **kw: date(*a, **kw)
            assert _current_football_season() == 2026


class TestBuildSystemPrompt:
    """Le prompt système contient date, saison et instructions de repli."""

    def test_contains_today_date(self) -> None:
        prompt = _build_system_prompt()
        today_str = date.today().isoformat()
        assert today_str in prompt

    def test_contains_current_season(self) -> None:
        prompt = _build_system_prompt()
        season = _current_football_season()
        assert f"{season}/{season + 1}" in prompt

    def test_contains_fallback_instruction(self) -> None:
        prompt = _build_system_prompt()
        assert "REPLI DE SAISON" in prompt

    def test_contains_user_warning_instruction(self) -> None:
        prompt = _build_system_prompt()
        # Must instruct LLM to warn user when falling back
        assert "prévenir l'utilisateur" in prompt

    def test_contains_fallback_example(self) -> None:
        prompt = _build_system_prompt()
        season = _current_football_season()
        # Example should mention both current and previous seasons
        assert f"{season - 1}/{season}" in prompt

    def test_prompt_is_not_empty(self) -> None:
        prompt = _build_system_prompt()
        assert len(prompt) > 200

    def test_prompt_contains_football_rule(self) -> None:
        prompt = _build_system_prompt()
        assert "RÈGLE ABSOLUE" in prompt

    def test_season_convention_explained(self) -> None:
        prompt = _build_system_prompt()
        assert "juillet" in prompt.lower() or "août" in prompt.lower()


class TestSeasonInPromptIntegration:
    """Vérifie que le prompt dynamique est effectivement utilisé par l'orchestrateur."""

    @pytest.mark.asyncio
    async def test_orchestrator_uses_dynamic_prompt(self) -> None:
        """L'orchestrateur injecte le prompt dynamique dans les messages."""
        from unittest.mock import AsyncMock

        from oria.core.orchestrator import Orchestrator
        from oria.kernel.models import Context, IncomingRequest

        mock_llm = AsyncMock()
        mock_llm.complete.return_value = {
            "choices": [
                {
                    "message": {"content": "PSG est premier."},
                    "finish_reason": "stop",
                },
            ],
        }

        orch = Orchestrator(llm=mock_llm, tools=None)
        req = IncomingRequest(
            user_id="u1", text="classement Ligue 1", context=Context(),
        )
        await orch.run(req)

        # Check the system message passed to the LLM
        call_args = mock_llm.complete.call_args
        messages = call_args[0][0]
        system_msg = messages[0]["content"]

        # Must contain today's date and season info
        assert date.today().isoformat() in system_msg
        assert "REPLI DE SAISON" in system_msg
