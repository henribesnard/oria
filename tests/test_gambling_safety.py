"""C-02 · Test : cotes non spontanées, restitution descriptive, jeu responsable.

Vérifie que :
- Les formulations prescriptives sont supprimées de toute réponse
- Le suffixe de jeu responsable est ajouté quand des cotes sont présentes
- La détresse liée au jeu produit toujours la ressource d'aide
- Le system prompt interdit get_odds sans intention explicite de paris
"""

from __future__ import annotations

import pytest

from oria.core.safety import detect_gambling_distress, GAMBLING_HELP_RESPONSE
from oria.core.synthesis import Synthesis, _ODDS_CONTENT_RE, _PRESCRIPTIVE_RE, _GAMBLING_SUFFIX


# ---------------------------------------------------------------------------
# Tests : filtre de formulations prescriptives
# ---------------------------------------------------------------------------


class TestPrescriptiveFilter:
    """Vérifie la suppression des formulations prescriptives."""

    @pytest.mark.parametrize("phrase", [
        "C'est un favori écrasant pour cette rencontre.",
        "Le signal fort du marché indique une victoire.",
        "Il faut miser sur le PSG ce soir.",
        "C'est une value bet intéressante.",
        "Les bookmakers donnent 1 but d'avance au PSG.",
        "Tu devrais miser sur le match nul.",
        "Tu devrais parier sur l'over 2.5.",
        "Je te recommandé de jouer le 1N2.",
    ])
    def test_prescriptive_phrases_detected(self, phrase: str) -> None:
        """Les formulations prescriptives sont bien détectées."""
        assert _PRESCRIPTIVE_RE.search(phrase) is not None

    @pytest.mark.parametrize("phrase", [
        "Le PSG a gagné 3-0.",
        "Le classement de la Ligue 1.",
        "Voici les cotes du match.",
        "Le match est prévu dimanche.",
    ])
    def test_safe_phrases_not_flagged(self, phrase: str) -> None:
        """Les phrases normales ne sont pas faussement détectées."""
        assert _PRESCRIPTIVE_RE.search(phrase) is None

    @pytest.mark.asyncio
    async def test_synthesis_removes_prescriptive(self) -> None:
        """La synthèse supprime les formulations prescriptives."""
        synthesis = Synthesis()
        text = (
            "Voici l'analyse du match.\n"
            "C'est un favori écrasant pour le PSG.\n"
            "Le score final est 3-0."
        )
        resp = await synthesis.render(text)
        assert "favori écrasant" not in resp.text
        assert "Le score final est 3-0" in resp.text


# ---------------------------------------------------------------------------
# Tests : suffixe de jeu responsable
# ---------------------------------------------------------------------------


class TestGamblingSuffix:
    """Vérifie l'ajout du suffixe de jeu responsable."""

    @pytest.mark.asyncio
    async def test_suffix_added_when_odds_present(self) -> None:
        """Le suffixe est ajouté quand des cotes sont présentes."""
        synthesis = Synthesis()
        text = "Voici les cotes du match PSG-OM : 1.85 - 3.40 - 4.20"
        resp = await synthesis.render(text)
        assert "joue de manière responsable" in resp.text
        assert "09 74 75 13 13" in resp.text

    @pytest.mark.asyncio
    async def test_suffix_not_added_without_odds(self) -> None:
        """Le suffixe n'est PAS ajouté quand pas de cotes."""
        synthesis = Synthesis()
        text = "Le PSG a gagné 3-0 contre l'OM hier soir."
        resp = await synthesis.render(text)
        assert "joue de manière responsable" not in resp.text

    @pytest.mark.asyncio
    async def test_suffix_not_duplicated(self) -> None:
        """Le suffixe n'est pas dupliqué si déjà présent."""
        synthesis = Synthesis()
        text = "Voici les cotes 1.85 - 3.40" + _GAMBLING_SUFFIX
        resp = await synthesis.render(text)
        assert resp.text.count("joue de manière responsable") == 1

    @pytest.mark.asyncio
    async def test_render_from_response_applies_suffix(self) -> None:
        """render_from_response applique aussi le suffixe."""
        from oria.kernel.models import Response

        synthesis = Synthesis()
        original = Response(text="Les bookmakers proposent 1.50 pour le PSG.")
        resp = await synthesis.render_from_response(original)
        assert "joue de manière responsable" in resp.text


# ---------------------------------------------------------------------------
# Tests : détection de contenu de cotes en sortie
# ---------------------------------------------------------------------------


class TestOddsContentDetection:
    """Vérifie la regex de détection de contenu de cotes."""

    @pytest.mark.parametrize("text", [
        "Les cotes sont de 1.85",
        "Chez le bookmaker Bet365",
        "Le marché 1N2 donne",
        "L'over/under 2.5",
        "Le handicap asiatique -0.75",
        "BTTS est à 1.72",
        "Both teams to score",
        "1.85 - 3.40 - 4.20",
    ])
    def test_odds_content_detected(self, text: str) -> None:
        assert _ODDS_CONTENT_RE.search(text) is not None

    @pytest.mark.parametrize("text", [
        "Le PSG a gagné 3-0.",
        "Classement de la Ligue 1 saison 2024.",
        "Mbappé a marqué 25 buts.",
    ])
    def test_non_odds_content_not_detected(self, text: str) -> None:
        assert _ODDS_CONTENT_RE.search(text) is None


# ---------------------------------------------------------------------------
# Tests : non-régression détresse liée au jeu
# ---------------------------------------------------------------------------


class TestGamblingDistressNonRegression:
    """La détresse liée au jeu continue de produire la ressource d'aide."""

    @pytest.mark.parametrize("text", [
        "j'ai tout perdu, comment me refaire ?",
        "je suis addicté aux paris",
        "j'ai perdu tout mon argent",
        "je suis accroc aux jeux",
    ])
    def test_distress_detected(self, text: str) -> None:
        assert detect_gambling_distress(text) is True

    def test_help_response_contains_hotline(self) -> None:
        assert "09 74 75 13 13" in GAMBLING_HELP_RESPONSE
        assert "adictel.com" in GAMBLING_HELP_RESPONSE


# ---------------------------------------------------------------------------
# Tests : le system prompt interdit get_odds sans intention explicite
# ---------------------------------------------------------------------------


class TestSystemPromptOddsRestriction:
    """Vérifie que le system prompt contient les règles sur les cotes."""

    def test_system_prompt_restricts_odds(self) -> None:
        from oria.core.orchestrator import _SYSTEM_PROMPT

        assert "get_odds" in _SYSTEM_PROMPT
        assert "EXPLICITEMENT" in _SYSTEM_PROMPT
        assert "INTERDITES" in _SYSTEM_PROMPT
        assert "favori écrasant" in _SYSTEM_PROMPT
