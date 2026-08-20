"""Tests pour H-04 : selection des matchs et semantique des vagues.

Verifie le filtre de proximite temporelle et la semantique temporelle
des vagues (W01-W09 = fenetres horaires, pas matchs).
"""

from __future__ import annotations

from datetime import date

import pytest

from tests.matchday.plan import (
    WAVE_GENERIC,
    WAVE_MID_MATCH,
    WAVE_POST_MATCH,
    WAVE_PRE_MATCH,
    DateProximityError,
    MatchTarget,
    _assign_wave,
    _match_date_proximity,
    build_plan,
    filter_by_date_proximity,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _match(
    fixture_id: int = 1234,
    match_date: str = "2026-08-22",
    status: str = "FT",
    league_id: int = 61,
) -> MatchTarget:
    return MatchTarget(
        fixture_id=fixture_id,
        home_team="PSG",
        home_id=85,
        away_team="Marseille",
        away_id=81,
        league_id=league_id,
        league_name="Ligue 1",
        date=match_date,
        status=status,
    )


# ---------------------------------------------------------------------------
# Tests date proximity
# ---------------------------------------------------------------------------


class TestDateProximity:
    def test_same_day(self) -> None:
        assert _match_date_proximity("2026-08-22", date(2026, 8, 22)) == 0

    def test_one_day(self) -> None:
        assert _match_date_proximity("2026-08-23", date(2026, 8, 22)) == 1

    def test_six_days(self) -> None:
        assert _match_date_proximity("2026-08-28", date(2026, 8, 22)) == 6

    def test_past_date(self) -> None:
        assert _match_date_proximity("2026-08-20", date(2026, 8, 22)) == 2

    def test_iso_datetime(self) -> None:
        assert _match_date_proximity("2026-08-22T15:00:00+00:00", date(2026, 8, 22)) == 0

    def test_invalid_date(self) -> None:
        assert _match_date_proximity("invalid", date(2026, 8, 22)) == 9999


class TestFilterByDateProximity:
    def test_keeps_close_matches(self) -> None:
        matches = [
            _match(1, "2026-08-22"),  # J+0
            _match(2, "2026-08-23"),  # J+1
            _match(3, "2026-08-28"),  # J+6
        ]
        result = filter_by_date_proximity(matches, reference=date(2026, 8, 22))
        assert len(result) == 2
        assert {m.fixture_id for m in result} == {1, 2}

    def test_raises_when_no_close_matches(self) -> None:
        matches = [
            _match(1, "2026-08-28"),  # J+6
            _match(2, "2026-08-29"),  # J+7
        ]
        with pytest.raises(DateProximityError) as exc_info:
            filter_by_date_proximity(matches, reference=date(2026, 8, 22))

        assert exc_info.value.reference_date == "2026-08-22"
        assert "2026-08-28" in exc_info.value.available_dates

    def test_empty_list_no_error(self) -> None:
        result = filter_by_date_proximity([], reference=date(2026, 8, 22))
        assert result == []

    def test_custom_max_days(self) -> None:
        matches = [_match(1, "2026-08-25")]  # J+3
        result = filter_by_date_proximity(
            matches, reference=date(2026, 8, 22), max_days=3,
        )
        assert len(result) == 1

    def test_custom_max_days_too_strict(self) -> None:
        matches = [_match(1, "2026-08-25")]  # J+3
        with pytest.raises(DateProximityError):
            filter_by_date_proximity(
                matches, reference=date(2026, 8, 22), max_days=2,
            )


class TestDateProximityErrorMessage:
    def test_error_has_details(self) -> None:
        err = DateProximityError("2026-08-22", 1, ["2026-08-28", "2026-08-29"])
        assert "2026-08-22" in str(err)
        assert "+/- 1j" in str(err)
        assert "2026-08-28" in str(err)


# ---------------------------------------------------------------------------
# Tests wave semantics
# ---------------------------------------------------------------------------


class TestAssignWave:
    def test_pre_match_categories(self) -> None:
        for cat in ["A1", "A2", "A4", "A6", "A8", "A10", "A12", "A16", "B1", "B2"]:
            assert _assign_wave(cat, "NS") == WAVE_PRE_MATCH

    def test_live_category_during_match(self) -> None:
        assert _assign_wave("C1", "1H") == WAVE_MID_MATCH
        assert _assign_wave("C1", "2H") == WAVE_MID_MATCH
        assert _assign_wave("C1", "HT") == WAVE_MID_MATCH

    def test_live_category_after_match(self) -> None:
        assert _assign_wave("C1", "FT") == WAVE_POST_MATCH

    def test_live_category_before_match(self) -> None:
        assert _assign_wave("C1", "NS") == WAVE_PRE_MATCH

    def test_post_match_categories(self) -> None:
        assert _assign_wave("A3", "FT") == WAVE_POST_MATCH


class TestBuildPlanWaveSemantics:
    def test_waves_are_temporal_not_per_match(self) -> None:
        """Les vagues representent des fenetres temporelles, pas des matchs."""
        matches = [
            _match(1, status="NS"),
            _match(2, status="NS"),
        ]
        plan = build_plan(matches, ["p1", "p2", "p3"], questions_per_match=3)

        # Wave IDs should be temporal (W01, W02, etc.), not per-match
        wave_ids = [w.wave_id for w in plan.waves]

        # W01 = generiques, W02 = pre-match (both matches together)
        assert WAVE_GENERIC in wave_ids
        assert WAVE_PRE_MATCH in wave_ids

        # Pre-match wave should contain questions from BOTH matches
        pre_match = next(w for w in plan.waves if w.wave_id == WAVE_PRE_MATCH)
        fixture_refs = {q.fixture_ref for q in pre_match.questions}
        assert len(fixture_refs) == 2  # Both matches in same temporal wave

    def test_generic_wave_is_w01(self) -> None:
        plan = build_plan([_match()], ["p1"], questions_per_match=1)
        assert plan.waves[0].wave_id == WAVE_GENERIC
        assert "generiques" in plan.waves[0].description.lower()

    def test_wave_descriptions_are_temporal(self) -> None:
        matches = [_match(status="FT")]
        plan = build_plan(matches, ["p1"], questions_per_match=5)

        for wave in plan.waves:
            # No wave description should be "Team A vs Team B"
            assert " vs " not in wave.description, (
                f"Wave {wave.wave_id} has per-match description: {wave.description}"
            )

    def test_live_questions_in_mid_match_wave(self) -> None:
        matches = [_match(status="1H")]  # Live match
        plan = build_plan(matches, ["p1"], questions_per_match=12)

        mid_match = [w for w in plan.waves if w.wave_id == WAVE_MID_MATCH]
        assert len(mid_match) == 1
        # C1 should be in mid-match wave for a live match
        c1_qs = [q for q in mid_match[0].questions if q.category == "C1"]
        assert len(c1_qs) == 1

    def test_finished_match_results_in_post_match(self) -> None:
        matches = [_match(status="FT")]
        plan = build_plan(matches, ["p1"], questions_per_match=12)

        # A3 (dernier resultat) should be in post-match for finished match
        post_match = [w for w in plan.waves if w.wave_id == WAVE_POST_MATCH]
        assert len(post_match) == 1
        a3_qs = [q for q in post_match[0].questions if q.category == "A3"]
        assert len(a3_qs) == 1

    def test_exchange_ids_match_wave(self) -> None:
        """Les exchange_id portent le wave_id de leur vague."""
        plan = build_plan([_match()], ["p1"], questions_per_match=3)

        for wave in plan.waves:
            for q in wave.questions:
                assert q.exchange_id.startswith(wave.wave_id), (
                    f"Exchange {q.exchange_id} should start with {wave.wave_id}"
                )

    def test_waves_ordered_temporally(self) -> None:
        """Les vagues sont ordonnees W01, W02, ..., W06."""
        matches = [_match(status="1H")]
        plan = build_plan(matches, ["p1"], questions_per_match=12)

        wave_ids = [w.wave_id for w in plan.waves]
        # Should be sorted
        assert wave_ids == sorted(wave_ids)
