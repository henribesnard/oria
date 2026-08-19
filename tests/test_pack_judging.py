"""Tests pour H-02 : generateur de batches de jugement.

Verifie que pack.py genere des batches auto-suffisants dans judging/,
avec verite terrain oracle en regard, index.csv, rubric.md, et temoins.
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path
from typing import Any

import pytest

from tests.matchday.pack import (
    BATCH_SIZE,
    CONTROL_WITNESSES,
    _exchange_checksum,
    _oracle_for_exchange,
    generate_batches,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_exchange(
    exchange_id: str = "W01-Q001",
    category: str = "A4",
    question: str = "classement Ligue 1",
    response_text: str = "Voici le classement...",
    persona: str = "premium_actif",
    persona_tier: str = "premium",
    fixture_ref: int | None = None,
    route: str = "orchestrator",
    degraded: bool = False,
    latency_ms: float = 500.0,
    context: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "exchange_id": exchange_id,
        "ts_utc": "2026-08-22T15:00:00+00:00",
        "wave": "W01",
        "persona": persona,
        "persona_tier": persona_tier,
        "category": category,
        "question": question,
        "context": context or {},
        "fixture_ref": fixture_ref,
        "response_text": response_text,
        "attachments": [],
        "suggested_actions": [],
        "degraded": degraded,
        "freshness": None,
        "latency_ms": latency_ms,
        "http_status": 200,
        "error": None,
        "route": route,
    }


def _setup_run_dir(tmp_path: Path, n_exchanges: int = 5) -> Path:
    """Cree un run_dir avec raw/ et oracle/."""
    run_dir = tmp_path / "matchday-20260822-1500"
    for d in ["raw", "oracle", "metrics", "logs", "judging"]:
        (run_dir / d).mkdir(parents=True)

    # Echanges
    for i in range(1, n_exchanges + 1):
        cat = "F0" if i == 1 else "A4"
        ex = _make_exchange(
            exchange_id=f"W01-Q{i:03d}",
            category=cat,
            fixture_ref=1234 if cat != "F0" else None,
            question="salut" if cat == "F0" else f"question {i}",
            response_text=f"reponse {i}",
        )
        (run_dir / "raw" / f"W01-Q{i:03d}.json").write_text(
            json.dumps(ex, ensure_ascii=False),
            encoding="utf-8",
        )

    # Oracle
    oracle_fixtures = {
        "collected_utc": "2026-08-22T15:00:00+00:00",
        "source": "api-football-direct",
        "fixtures": [{
            "fixture_id": 1234,
            "collected_utc": "2026-08-22T15:00:00+00:00",
            "fixture": {
                "status": "FT",
                "goals_home": 2,
                "goals_away": 1,
                "home": {"id": 85, "name": "PSG"},
                "away": {"id": 81, "name": "Marseille"},
            },
        }],
    }
    (run_dir / "oracle" / "fixtures.json").write_text(
        json.dumps(oracle_fixtures, ensure_ascii=False),
        encoding="utf-8",
    )

    return run_dir


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGenerateBatches:
    def test_creates_batch_files(self, tmp_path: Path) -> None:
        run_dir = _setup_run_dir(tmp_path, n_exchanges=5)
        paths = generate_batches(run_dir)

        assert len(paths) >= 1
        assert all(p.exists() for p in paths)
        assert all(p.suffix == ".md" for p in paths)

    def test_batch_contains_exchanges(self, tmp_path: Path) -> None:
        run_dir = _setup_run_dir(tmp_path, n_exchanges=3)
        generate_batches(run_dir)

        batch = (run_dir / "judging" / "batch_001.md").read_text(encoding="utf-8")
        assert "## Echange 1" in batch
        assert "## Echange 2" in batch
        assert "## Echange 3" in batch

    def test_batch_contains_oracle_truth(self, tmp_path: Path) -> None:
        """Chaque echange avec un fixture_ref a la verite terrain en regard."""
        run_dir = _setup_run_dir(tmp_path, n_exchanges=3)
        generate_batches(run_dir)

        batch = (run_dir / "judging" / "batch_001.md").read_text(encoding="utf-8")
        # Exchanges with fixture_ref=1234 should have oracle data
        assert "Verite terrain (Oracle)" in batch
        assert '"status": "FT"' in batch
        assert '"goals_home": 2' in batch

    def test_batch_is_self_sufficient(self, tmp_path: Path) -> None:
        """Un batch contient question, reponse, oracle, grille de notation."""
        run_dir = _setup_run_dir(tmp_path, n_exchanges=2)
        generate_batches(run_dir)

        batch = (run_dir / "judging" / "batch_001.md").read_text(encoding="utf-8")

        # Question present
        assert "### Question" in batch
        # Reponse present
        assert "### Reponse ORIA" in batch
        # Oracle present
        assert "### Verite terrain" in batch
        # Notation grid present
        assert "### Notation" in batch
        assert "Exactitude factuelle" in batch
        assert "Completude" in batch
        assert "Fidelite au role" in batch
        assert "Conformite produit" in batch

    def test_multiple_batches_for_large_runs(self, tmp_path: Path) -> None:
        """Les echanges sont repartis en batches de BATCH_SIZE."""
        n = BATCH_SIZE + 3  # Should create 2 batches
        run_dir = _setup_run_dir(tmp_path, n_exchanges=n)
        paths = generate_batches(run_dir)

        assert len(paths) == 2
        # First batch should have BATCH_SIZE exchanges
        batch1 = (run_dir / "judging" / "batch_001.md").read_text(encoding="utf-8")
        assert f"## Echange {BATCH_SIZE}" in batch1
        # Second batch should have 3 exchanges
        batch2 = (run_dir / "judging" / "batch_002.md").read_text(encoding="utf-8")
        assert "## Echange 3" in batch2

    def test_witness_tag_on_control_categories(self, tmp_path: Path) -> None:
        """Les echanges F0, G1, F1, H1, F7 portent le tag [TEMOIN]."""
        run_dir = _setup_run_dir(tmp_path, n_exchanges=3)
        generate_batches(run_dir)

        batch = (run_dir / "judging" / "batch_001.md").read_text(encoding="utf-8")
        # First exchange is F0, should be tagged as witness
        assert "[TEMOIN]" in batch


class TestRubric:
    def test_rubric_generated(self, tmp_path: Path) -> None:
        run_dir = _setup_run_dir(tmp_path)
        generate_batches(run_dir)

        rubric_path = run_dir / "judging" / "rubric.md"
        assert rubric_path.exists()
        content = rubric_path.read_text(encoding="utf-8")
        assert "Exactitude factuelle" in content
        assert "Completude" in content
        assert "0-5" in content


class TestIndexCsv:
    def test_index_generated(self, tmp_path: Path) -> None:
        run_dir = _setup_run_dir(tmp_path, n_exchanges=3)
        generate_batches(run_dir)

        index_path = run_dir / "judging" / "index.csv"
        assert index_path.exists()

        content = index_path.read_text(encoding="utf-8")
        reader = csv.DictReader(io.StringIO(content))
        rows = list(reader)

        assert len(rows) == 3
        assert "exchange_id" in rows[0]
        assert "batch" in rows[0]
        assert "category" in rows[0]
        assert "has_oracle" in rows[0]
        assert "checksum" in rows[0]

    def test_index_batch_references(self, tmp_path: Path) -> None:
        """L'index reference le bon batch pour chaque echange."""
        run_dir = _setup_run_dir(tmp_path, n_exchanges=3)
        generate_batches(run_dir)

        content = (run_dir / "judging" / "index.csv").read_text(encoding="utf-8")
        reader = csv.DictReader(io.StringIO(content))
        for row in reader:
            assert row["batch"] == "batch_001"


class TestWitnesses:
    def test_witnesses_generated(self, tmp_path: Path) -> None:
        run_dir = _setup_run_dir(tmp_path)
        generate_batches(run_dir)

        witnesses_path = run_dir / "judging" / "witnesses.json"
        assert witnesses_path.exists()

        data = json.loads(witnesses_path.read_text(encoding="utf-8"))
        assert len(data["witnesses"]) == 12

    def test_witnesses_have_expected_fields(self, tmp_path: Path) -> None:
        for w in CONTROL_WITNESSES:
            assert "category" in w
            assert "question" in w
            assert "expected_route" in w
            assert "check" in w


class TestOracleForExchange:
    def test_matches_fixture_ref(self) -> None:
        oracle = {"fixture_1234": {"status": "FT"}}
        ex = {"fixture_ref": 1234, "context": {}}
        assert _oracle_for_exchange(ex, oracle) == {"status": "FT"}

    def test_matches_league_id_from_context(self) -> None:
        oracle = {"standings_61": {"league_id": 61, "standings": []}}
        ex = {"fixture_ref": None, "context": {"league_id": 61}}
        assert _oracle_for_exchange(ex, oracle) == {"league_id": 61, "standings": []}

    def test_returns_none_when_no_match(self) -> None:
        oracle = {}
        ex = {"fixture_ref": None, "context": {}}
        assert _oracle_for_exchange(ex, oracle) is None


class TestChecksum:
    def test_deterministic(self) -> None:
        ex = _make_exchange()
        assert _exchange_checksum(ex) == _exchange_checksum(ex)

    def test_different_for_different_exchanges(self) -> None:
        ex1 = _make_exchange(exchange_id="Q1")
        ex2 = _make_exchange(exchange_id="Q2")
        assert _exchange_checksum(ex1) != _exchange_checksum(ex2)

    def test_length_12(self) -> None:
        ex = _make_exchange()
        assert len(_exchange_checksum(ex)) == 12


class TestNoRawDirHandled:
    def test_no_exchanges(self, tmp_path: Path) -> None:
        """Pas de raw/ -> pas de crash, pas de batches."""
        run_dir = tmp_path / "empty-run"
        run_dir.mkdir()
        paths = generate_batches(run_dir)
        assert paths == []
