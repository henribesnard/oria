"""Tests C-08 — appels outils parallèles dans l'orchestrateur."""

from __future__ import annotations

import asyncio
import json
from typing import Any
from unittest.mock import AsyncMock

import pytest

from oria.core.orchestrator import Orchestrator
from oria.kernel.models import Context, IncomingRequest
from oria.tools.registry import ToolRegistry


def _make_req(text: str = "classement et blessures") -> IncomingRequest:
    return IncomingRequest(user_id="u1", text=text, context=Context())


class TestParallelToolCalls:
    """Les appels outils du LLM sont exécutés en parallèle."""

    @pytest.mark.asyncio
    async def test_two_tools_run_concurrently(self) -> None:
        """Deux outils sont appelés en parallèle, pas séquentiellement."""
        execution_log: list[tuple[str, str]] = []  # (tool, event)

        async def slow_tool_a(**_kwargs: Any) -> dict[str, str]:
            execution_log.append(("tool_a", "start"))
            await asyncio.sleep(0.05)
            execution_log.append(("tool_a", "end"))
            return {"data": "a"}

        async def slow_tool_b(**_kwargs: Any) -> dict[str, str]:
            execution_log.append(("tool_b", "start"))
            await asyncio.sleep(0.05)
            execution_log.append(("tool_b", "end"))
            return {"data": "b"}

        registry = ToolRegistry()
        registry.register("tool_a", "Tool A", {"type": "object", "properties": {}}, slow_tool_a)
        registry.register("tool_b", "Tool B", {"type": "object", "properties": {}}, slow_tool_b)

        mock_llm = AsyncMock()
        # Round 1: LLM calls two tools
        # Round 2: LLM generates final answer
        mock_llm.complete.side_effect = [
            {
                "choices": [{
                    "message": {
                        "tool_calls": [
                            {"id": "c1", "function": {"name": "tool_a", "arguments": "{}"}},
                            {"id": "c2", "function": {"name": "tool_b", "arguments": "{}"}},
                        ],
                    },
                    "finish_reason": "tool_calls",
                }],
            },
            {
                "choices": [{
                    "message": {"content": "Résultat combiné."},
                    "finish_reason": "stop",
                }],
            },
        ]

        orch = Orchestrator(llm=mock_llm, tools=registry)
        result = await orch.run(_make_req())

        assert result == "Résultat combiné."
        # Both tools should have started before either finished (parallel)
        starts = [i for i, (_, e) in enumerate(execution_log) if e == "start"]
        ends = [i for i, (_, e) in enumerate(execution_log) if e == "end"]
        # In parallel: both starts come before both ends
        assert len(starts) == 2
        assert len(ends) == 2
        assert max(starts) < min(ends)

    @pytest.mark.asyncio
    async def test_single_tool_call_works(self) -> None:
        """Un seul appel outil fonctionne normalement."""
        async def tool_fn(**_kwargs: Any) -> dict[str, str]:
            return {"result": "ok"}

        registry = ToolRegistry()
        registry.register("tool_x", "Tool X", {"type": "object", "properties": {}}, tool_fn)

        mock_llm = AsyncMock()
        mock_llm.complete.side_effect = [
            {
                "choices": [{
                    "message": {
                        "tool_calls": [
                            {"id": "c1", "function": {"name": "tool_x", "arguments": "{}"}},
                        ],
                    },
                    "finish_reason": "tool_calls",
                }],
            },
            {
                "choices": [{
                    "message": {"content": "Résultat unique."},
                    "finish_reason": "stop",
                }],
            },
        ]

        orch = Orchestrator(llm=mock_llm, tools=registry)
        result = await orch.run(_make_req())
        assert result == "Résultat unique."

    @pytest.mark.asyncio
    async def test_tool_failure_does_not_block_others(self) -> None:
        """Un outil en échec ne bloque pas les autres."""
        async def good_tool(**_kwargs: Any) -> dict[str, str]:
            return {"ok": True}

        async def bad_tool(**_kwargs: Any) -> dict[str, str]:
            msg = "boom"
            raise RuntimeError(msg)

        registry = ToolRegistry()
        registry.register("good", "Good", {"type": "object", "properties": {}}, good_tool)
        registry.register("bad", "Bad", {"type": "object", "properties": {}}, bad_tool)

        mock_llm = AsyncMock()
        mock_llm.complete.side_effect = [
            {
                "choices": [{
                    "message": {
                        "tool_calls": [
                            {"id": "c1", "function": {"name": "good", "arguments": "{}"}},
                            {"id": "c2", "function": {"name": "bad", "arguments": "{}"}},
                        ],
                    },
                    "finish_reason": "tool_calls",
                }],
            },
            {
                "choices": [{
                    "message": {"content": "Réponse partielle."},
                    "finish_reason": "stop",
                }],
            },
        ]

        orch = Orchestrator(llm=mock_llm, tools=registry)
        result = await orch.run(_make_req())
        assert result == "Réponse partielle."

        # Check the tool messages sent to LLM
        second_call_messages = mock_llm.complete.call_args_list[1][0][0]
        tool_msgs = [m for m in second_call_messages if m.get("role") == "tool"]
        assert len(tool_msgs) == 2

        # One success, one error
        contents = [json.loads(m["content"]) for m in tool_msgs]
        has_ok = any("ok" in c for c in contents)
        has_error = any("error" in c for c in contents)
        assert has_ok
        assert has_error

    @pytest.mark.asyncio
    async def test_invalid_json_args_handled(self) -> None:
        """Des arguments JSON invalides sont gérés sans bloquer."""
        async def tool_fn(**_kwargs: Any) -> dict[str, str]:
            return {"ok": True}

        registry = ToolRegistry()
        registry.register("tool_x", "Tool X", {"type": "object", "properties": {}}, tool_fn)

        mock_llm = AsyncMock()
        mock_llm.complete.side_effect = [
            {
                "choices": [{
                    "message": {
                        "tool_calls": [
                            {"id": "c1", "function": {"name": "tool_x", "arguments": "{invalid}"}},
                        ],
                    },
                    "finish_reason": "tool_calls",
                }],
            },
            {
                "choices": [{
                    "message": {"content": "Erreur gérée."},
                    "finish_reason": "stop",
                }],
            },
        ]

        orch = Orchestrator(llm=mock_llm, tools=registry)
        result = await orch.run(_make_req())
        assert result == "Erreur gérée."

    @pytest.mark.asyncio
    async def test_tool_results_order_preserved(self) -> None:
        """L'ordre des résultats correspond à l'ordre des appels (tool_call_id)."""
        call_order: list[str] = []

        async def tool_fast(**_kwargs: Any) -> dict[str, str]:
            call_order.append("fast")
            return {"tool": "fast"}

        async def tool_slow(**_kwargs: Any) -> dict[str, str]:
            await asyncio.sleep(0.03)
            call_order.append("slow")
            return {"tool": "slow"}

        registry = ToolRegistry()
        registry.register("fast", "Fast", {"type": "object", "properties": {}}, tool_fast)
        registry.register("slow", "Slow", {"type": "object", "properties": {}}, tool_slow)

        mock_llm = AsyncMock()
        mock_llm.complete.side_effect = [
            {
                "choices": [{
                    "message": {
                        "tool_calls": [
                            {"id": "c_slow", "function": {"name": "slow", "arguments": "{}"}},
                            {"id": "c_fast", "function": {"name": "fast", "arguments": "{}"}},
                        ],
                    },
                    "finish_reason": "tool_calls",
                }],
            },
            {
                "choices": [{
                    "message": {"content": "Done."},
                    "finish_reason": "stop",
                }],
            },
        ]

        orch = Orchestrator(llm=mock_llm, tools=registry)
        await orch.run(_make_req())

        # Tool results in messages should match tool_call order
        second_call_messages = mock_llm.complete.call_args_list[1][0][0]
        tool_msgs = [m for m in second_call_messages if m.get("role") == "tool"]
        assert tool_msgs[0]["tool_call_id"] == "c_slow"
        assert tool_msgs[1]["tool_call_id"] == "c_fast"
