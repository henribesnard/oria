"""Tests LiveRepository — parsing clé league vs fixture."""

from __future__ import annotations

from typing import Any
from unittest.mock import AsyncMock

import pytest

from oria.domain.live import LiveRepository
from oria.storage.cache import Cache
from oria.storage.db import Database


@pytest.fixture
async def live_db() -> Any:
    database = Database(db_path=":memory:")
    await database.start()
    yield database
    await database.stop()


@pytest.fixture
async def live_cache(live_db: Database) -> Cache:
    cache = Cache(db=live_db)
    await cache.start()
    return cache


def _fake_api_response(fixture_id: int = 123) -> dict[str, Any]:
    """Réponse API-Football minimale pour un fixture."""
    return {
        "response": [
            {
                "fixture": {"id": fixture_id, "status": {"short": "1H"}},
                "league": {"id": 61, "name": "Ligue 1"},
                "teams": {
                    "home": {"id": 1, "name": "PSG"},
                    "away": {"id": 2, "name": "OM"},
                },
                "goals": {"home": 1, "away": 0},
                "score": {},
            },
        ],
        "results": 1,
    }


class TestLiveRepositoryKeyParsing:
    """P1: _fetch doit distinguer league=X de fixture:X."""

    async def test_league_key_sends_league_param(self, live_cache: Cache) -> None:
        """Clé simple (league ID) → params['league'] = key."""
        mock_client = AsyncMock()
        mock_client.fetch = AsyncMock(return_value=_fake_api_response())

        repo = LiveRepository(cache=live_cache, client=mock_client)
        await repo.get("61", allow_stale=False)

        mock_client.fetch.assert_called_once()
        _endpoint, params = mock_client.fetch.call_args.args
        assert params.get("league") == "61"
        assert "id" not in params
        assert params.get("live") == "all"

    async def test_fixture_key_sends_id_param(self, live_cache: Cache) -> None:
        """Clé 'fixture:123' → params['id'] = '123', pas params['league']."""
        mock_client = AsyncMock()
        mock_client.fetch = AsyncMock(return_value=_fake_api_response())

        repo = LiveRepository(cache=live_cache, client=mock_client)
        await repo.get("fixture:123", allow_stale=False)

        mock_client.fetch.assert_called_once()
        _endpoint, params = mock_client.fetch.call_args.args
        assert params.get("id") == "123"
        assert "league" not in params
        assert params.get("live") == "all"

    async def test_empty_key_sends_live_all_only(self, live_cache: Cache) -> None:
        """Clé vide → params = {'live': 'all'} seulement."""
        mock_client = AsyncMock()
        mock_client.fetch = AsyncMock(return_value=_fake_api_response())

        repo = LiveRepository(cache=live_cache, client=mock_client)
        await repo.get("", allow_stale=False)

        mock_client.fetch.assert_called_once()
        _endpoint, params = mock_client.fetch.call_args.args
        assert params == {"live": "all"}
