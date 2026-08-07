"""Pré-routeur d'intention — répond au trivial sans LLM (famille A)."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import Attachment, IncomingRequest, Response, SuggestedAction

if TYPE_CHECKING:
    from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class PreRouter:
    """Module optionnel : filtre les requêtes triviales sans LLM."""

    name: str = "prerouter"
    required: bool = False
    provides: tuple[str, ...] = ("prerouting",)

    def __init__(self, *, tools: ToolRegistry | None = None) -> None:
        self._tools = tools

    async def start(self) -> None:
        logger.info("prerouter ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def try_route(self, req: IncomingRequest) -> Response | None:
        """Renvoie une Response si la requête matche un pattern, sinon None."""
        text = req.text.strip().lower()

        # Salutations
        if re.search(r"\b(bonjour|salut|hello|hey|coucou)\b", text, re.IGNORECASE):
            return Response(
                text="Salut ! Je suis Oria, ton assistant football. "
                "Comment puis-je t'aider ?",
                suggested_actions=[
                    SuggestedAction(label="Classement Ligue 1", payload={"text": "classement ligue 1"}),
                    SuggestedAction(label="Prochain match PSG", payload={"text": "prochain match du PSG"}),
                ],
            )

        # Aide
        if re.search(r"\b(aide|help)\b", text, re.IGNORECASE):
            return Response(
                text="Je peux t'aider avec les classements, résultats, matchs à venir, "
                "compositions, blessures et plus encore. Pose-moi ta question !",
            )

        # Famille A : classement
        if re.search(r"\b(classement|standings?)\b", text, re.IGNORECASE):
            return await self._handle_standings(req)

        # Famille A : prochain match
        if re.search(r"\b(prochain\s+match|next\s+match)\b", text, re.IGNORECASE):
            return await self._handle_next_match(req)

        # Famille A : dernier résultat
        if re.search(r"\b(dernier\s+r[eé]sultat|last\s+result|score)\b", text, re.IGNORECASE):
            return await self._handle_last_result(req)

        # Famille A : forme récente
        if re.search(r"\b(forme|form)\b", text, re.IGNORECASE):
            return await self._handle_form(req)

        # Famille A : calendrier
        if re.search(r"\b(calendrier|programme|schedule)\b", text, re.IGNORECASE):
            return await self._handle_schedule(req)

        # Famille A : matchs (génériques)
        if re.search(r"\b(matchs?|fixtures?|rencontres?)\b", text, re.IGNORECASE):
            return await self._handle_matches(req)

        # Famille B : blessures
        if re.search(r"\b(blessures?|injur|bless[eé]s?)\b", text, re.IGNORECASE):
            return await self._handle_injuries(req)

        # Famille B : joueurs / stats
        if re.search(r"\b(joueurs?|players?|effectif|stats?\b)", text, re.IGNORECASE):
            return await self._handle_players(req)

        # Famille B : infos équipe
        if re.search(r"\b(infos?|informations?|qui\s+est)\b", text, re.IGNORECASE):
            return await self._handle_team_info(req)

        # Famille B : scores en direct
        if re.search(r"\b(en\s+direct|live|en\s+cours)\b", text, re.IGNORECASE):
            return await self._handle_live(req)

        # Famille B : cotes
        if re.search(r"\b(cotes?|odds?|pronostics?)\b", text, re.IGNORECASE):
            return await self._handle_odds(req)

        return None

    # -- Handlers famille A (via outils, sans LLM) --

    async def _handle_standings(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {}
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            if req.context.season:
                params["season"] = req.context.season
            data = await self._tools.call("get_standings", params)
            if data:
                return Response(
                    text="Voici le classement actuel.",
                    attachments=[Attachment(kind="table", data={"standings": data})],
                )
        except Exception:
            logger.debug("prerouter standings failed", exc_info=True)
        return None

    async def _handle_next_match(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {"next": 1}
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            data = await self._tools.call("get_fixtures", params)
            if data:
                return Response(
                    text="Voici le prochain match.",
                    attachments=[Attachment(kind="fixture_card", data={"fixtures": data})],
                )
        except Exception:
            logger.debug("prerouter next match failed", exc_info=True)
        return None

    async def _handle_last_result(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {"last": 1}
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            data = await self._tools.call("get_fixtures", params)
            if data:
                return Response(
                    text="Voici le dernier résultat.",
                    attachments=[Attachment(kind="fixture_card", data={"fixtures": data})],
                )
        except Exception:
            logger.debug("prerouter last result failed", exc_info=True)
        return None

    async def _handle_form(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {"last": 5}
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            data = await self._tools.call("get_fixtures", params)
            if data:
                return Response(
                    text="Voici la forme récente.",
                    attachments=[Attachment(kind="table", data={"form": data})],
                )
        except Exception:
            logger.debug("prerouter form failed", exc_info=True)
        return None

    async def _handle_schedule(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {"next": 5}
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            data = await self._tools.call("get_fixtures", params)
            if data:
                return Response(
                    text="Voici les prochains matchs.",
                    attachments=[Attachment(kind="table", data={"schedule": data})],
                )
        except Exception:
            logger.debug("prerouter schedule failed", exc_info=True)
        return None

    async def _handle_matches(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {}
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            if req.context.season:
                params["season"] = req.context.season
            data = await self._tools.call("get_fixtures", params)
            if data:
                return Response(
                    text="Voici les matchs.",
                    attachments=[Attachment(kind="table", data={"fixtures": data})],
                )
        except Exception:
            logger.debug("prerouter matches failed", exc_info=True)
        return None

    # -- Handlers famille B (via outils, sans LLM) --

    async def _handle_injuries(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {}
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            if req.context.season:
                params["season"] = req.context.season
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            if req.context.fixture_id:
                params["fixture_id"] = req.context.fixture_id
            data = await self._tools.call("get_injuries", params)
            if data:
                return Response(
                    text="Voici les blessures et suspensions.",
                    attachments=[Attachment(kind="table", data={"injuries": data})],
                )
        except Exception:
            logger.debug("prerouter injuries failed", exc_info=True)
        return None

    async def _handle_players(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {}
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            if req.context.season:
                params["season"] = req.context.season
            if req.context.player_id:
                params["player_id"] = req.context.player_id
            data = await self._tools.call("get_player_stats", params)
            if data:
                return Response(
                    text="Voici les statistiques des joueurs.",
                    attachments=[Attachment(kind="table", data={"players": data})],
                )
        except Exception:
            logger.debug("prerouter players failed", exc_info=True)
        return None

    async def _handle_team_info(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {}
            if req.context.team_id:
                params["team_id"] = req.context.team_id
            data = await self._tools.call("get_team_info", params)
            if data:
                return Response(
                    text="Voici les informations sur l'équipe.",
                    attachments=[Attachment(kind="table", data={"team": data})],
                )
        except Exception:
            logger.debug("prerouter team info failed", exc_info=True)
        return None

    async def _handle_live(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {}
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            data = await self._tools.call("get_live_scores", params)
            if data:
                return Response(
                    text="Voici les scores en direct.",
                    attachments=[Attachment(kind="table", data={"live": data})],
                )
        except Exception:
            logger.debug("prerouter live failed", exc_info=True)
        return None

    async def _handle_odds(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            params: dict[str, Any] = {}
            if req.context.fixture_id:
                params["fixture_id"] = req.context.fixture_id
            if req.context.league_id:
                params["league_id"] = req.context.league_id
            if req.context.season:
                params["season"] = req.context.season
            data = await self._tools.call("get_odds", params)
            if data:
                return Response(
                    text="Voici les cotes pré-match.",
                    attachments=[Attachment(kind="table", data={"odds": data})],
                )
        except Exception:
            logger.debug("prerouter odds failed", exc_info=True)
        return None
