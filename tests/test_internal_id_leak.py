"""Tests C-06 — fuite d'identifiants internes : le filtre post-LLM les supprime."""

from __future__ import annotations

import pytest

from oria.core.synthesis import Synthesis, _strip_internal_ids


class TestStripInternalIds:
    """Le filtre supprime les identifiants internes du texte LLM."""

    # ---- fixture identifiers ----

    def test_strip_fixture_id_equals(self) -> None:
        assert _strip_internal_ids("Le match fixture_id=12345 commence.") == "Le match commence."

    def test_strip_fixture_id_colon(self) -> None:
        assert _strip_internal_ids("Résultat fixture_id: 98765 ci-dessous.") == "Résultat ci-dessous."

    def test_strip_fixture_id_space(self) -> None:
        assert _strip_internal_ids("J'ai trouvé fixture_id 54321 dans les données.") == "J'ai trouvé dans les données."

    def test_strip_fixture_equals(self) -> None:
        result = _strip_internal_ids("Données pour fixture=12345.")
        assert "fixture" not in result
        assert "12345" not in result

    def test_strip_fixture_large_number(self) -> None:
        assert _strip_internal_ids("Le fixture 123456 est terminé.") == "Le est terminé."

    # ---- team identifiers ----

    def test_strip_team_id_equals(self) -> None:
        assert _strip_internal_ids("L'équipe team_id=85 a gagné.") == "L'équipe a gagné."

    def test_strip_team_id_space(self) -> None:
        assert _strip_internal_ids("Voir team_id 42 pour plus.") == "Voir pour plus."

    def test_strip_team_equals(self) -> None:
        result = _strip_internal_ids("Résultat pour team=85.")
        assert "team=85" not in result

    def test_strip_team_large_number(self) -> None:
        # team + 3+ digit number stripped
        assert _strip_internal_ids("Le team 1234 est premier.") == "Le est premier."

    def test_keep_team_small_number(self) -> None:
        # "team 85" has only 2 digits — NOT stripped (to avoid false positives)
        result = _strip_internal_ids("L'équipe team 85 est forte.")
        assert "85" in result

    # ---- league identifiers ----

    def test_strip_league_id_equals(self) -> None:
        result = _strip_internal_ids("Classement league_id=61.")
        assert "league_id" not in result

    def test_strip_league_id_space(self) -> None:
        assert _strip_internal_ids("Données league_id 61 disponibles.") == "Données disponibles."

    def test_strip_league_equals(self) -> None:
        assert _strip_internal_ids("Pour league=61 cette saison.") == "Pour cette saison."

    # ---- player identifiers ----

    def test_strip_player_id_equals(self) -> None:
        assert _strip_internal_ids("Le joueur player_id=276 a marqué.") == "Le joueur a marqué."

    def test_strip_player_id_space(self) -> None:
        result = _strip_internal_ids("Stats de player_id 276.")
        assert "player_id" not in result
        assert "276" not in result

    # ---- generic ID ----

    def test_strip_generic_id_large(self) -> None:
        assert _strip_internal_ids("Match ID 12345 en cours.") == "Match en cours."

    def test_keep_generic_id_small(self) -> None:
        # "ID 42" has only 2 digits — kept
        result = _strip_internal_ids("Journée ID 42 de la ligue.")
        assert "42" in result

    # ---- API paths ----

    def test_strip_api_fixtures_path(self) -> None:
        assert _strip_internal_ids("Appel à /fixtures pour les données.") == "Appel à pour les données."

    def test_strip_api_standings_path(self) -> None:
        assert _strip_internal_ids("Via /standings on obtient le classement.") == "Via on obtient le classement."  # noqa: RUF001

    def test_strip_api_odds_path(self) -> None:
        assert _strip_internal_ids("Les cotes depuis /odds sont à jour.") == "Les cotes depuis sont à jour."

    # ---- tool function names ----

    def test_strip_get_standings(self) -> None:
        cleaned = _strip_internal_ids("J'utilise get_standings pour récupérer le classement.")
        assert "get_standings" not in cleaned

    def test_strip_get_fixtures(self) -> None:
        cleaned = _strip_internal_ids("Via get_fixtures j'ai obtenu les matchs.")
        assert "get_fixtures" not in cleaned

    def test_strip_get_live_scores(self) -> None:
        cleaned = _strip_internal_ids("get_live_scores renvoie les scores en direct.")
        assert "get_live_scores" not in cleaned

    # ---- orphaned brackets ----

    def test_strip_orphaned_parentheses(self) -> None:
        result = _strip_internal_ids("Le match (fixture_id=123) est terminé.")
        assert "()" not in result

    def test_strip_orphaned_brackets(self) -> None:
        result = _strip_internal_ids("Données [league_id=61] disponibles.")
        assert "[]" not in result

    # ---- no false positive on normal text ----

    def test_keep_normal_text(self) -> None:
        text = "Le PSG a battu l'OM 3-1 lors de la 5e journée de Ligue 1."
        assert _strip_internal_ids(text) == text

    def test_keep_scores(self) -> None:
        text = "Score final : 2-0 pour le Real Madrid."
        assert _strip_internal_ids(text) == text

    def test_keep_player_names(self) -> None:
        text = "Mbappé a marqué le 1er but à la 23e minute."
        assert _strip_internal_ids(text) == text

    # ---- case insensitive ----

    def test_case_insensitive_fixture_id(self) -> None:
        assert _strip_internal_ids("FIXTURE_ID=123 trouvé.") == "trouvé."

    def test_case_insensitive_team_id(self) -> None:
        assert _strip_internal_ids("Team_Id=85 sélectionné.") == "sélectionné."


class TestSynthesisRendersClean:
    """Synthesis.render() applique le filtre anti-fuites."""

    @pytest.mark.asyncio
    async def test_render_strips_ids(self) -> None:
        synthesis = Synthesis()
        resp = await synthesis.render(
            "Le classement (league_id=61) montre le PSG en tête.",
        )
        assert "league_id" not in resp.text
        assert "PSG" in resp.text

    @pytest.mark.asyncio
    async def test_render_strips_tool_names(self) -> None:
        synthesis = Synthesis()
        resp = await synthesis.render(
            "Selon get_standings, le PSG est premier.",
        )
        assert "get_standings" not in resp.text
        assert "PSG" in resp.text

    @pytest.mark.asyncio
    async def test_render_preserves_normal_text(self) -> None:
        synthesis = Synthesis()
        text = "Le PSG est premier avec 45 points."
        resp = await synthesis.render(text)
        assert resp.text == text

    @pytest.mark.asyncio
    async def test_render_preserves_freshness(self) -> None:
        synthesis = Synthesis()
        resp = await synthesis.render(
            "Classement à jour.", freshness="il y a 5 min",
        )
        assert resp.freshness == "il y a 5 min"

    @pytest.mark.asyncio
    async def test_render_multiple_leaks(self) -> None:
        synthesis = Synthesis()
        resp = await synthesis.render(
            "Le match fixture_id=123 entre team_id=85 et team_id=87, "
            "en league_id=61, donne PSG 3-1 OM.",
        )
        assert "fixture_id" not in resp.text
        assert "team_id" not in resp.text
        assert "league_id" not in resp.text
        assert "PSG" in resp.text
        assert "OM" in resp.text
