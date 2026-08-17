"""Pre-routeur d'intention -- repond au trivial sans LLM (famille A)."""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING, Any

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import Attachment, IncomingRequest, Response, SuggestedAction

if TYPE_CHECKING:
    from oria.app.entitlements.service import Entitlements
    from oria.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

# -- Regex compiles (niveau module) --

_GREETING_RE = re.compile(
    r"\b(bonjour|bonsoir|salut|hello|hey|coucou)\b", re.IGNORECASE,
)
_ACK_RE = re.compile(
    r"\b(merci|bonne\s+nuit|[cç]a\s+va|ok|super|cool|parfait|"
    r"g[eé]nial|d[''']accord)\b",
    re.IGNORECASE,
)
_HELP_RE = re.compile(r"\b(aide|help)\b", re.IGNORECASE)

_META_INTENT_RE = re.compile(
    r"\b(comment\s+(?:lire|comprendre|fonctionne|marche|calculer)|"
    r"pourquoi|qu[''']est[- ]ce\s+qu|c[''']est\s+quoi|"
    r"r[eè]gle|expliqu|signifie|veut\s+dire|"
    r"pas\s+bon|pas\s+correct|erreur|bug|faux|incorrect|"
    r"ne\s+marche\s+pas|ne\s+fonctionne\s+pas)\b",
    re.IGNORECASE,
)

_NOTIF_ANALYSIS_RE = re.compile(
    r"\b(pr[eé]viens|rappel|notifi|alerte|value|paris?|"
    r"raconte|analyse|r[eé]sum[eé]|bilan)\b",
    re.IGNORECASE,
)


class PreRouter:
    """Module optionnel : filtre les requetes triviales sans LLM."""

    name: str = "prerouter"
    required: bool = False
    provides: tuple[str, ...] = ("prerouting",)

    def __init__(
        self,
        *,
        tools: ToolRegistry | None = None,
        entitlements: Entitlements | None = None,
    ) -> None:
        self._tools = tools
        self._entitlements = entitlements

    async def start(self) -> None:
        logger.info("prerouter ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def _resolve_team_id(self, req: IncomingRequest) -> int | None:
        """Tente d'extraire un nom d'equipe du texte et de le resoudre en ID."""
        if req.context.team_id or req.context.fixture_id or self._tools is None:
            return req.context.team_id
        text = req.text.strip()
        m = re.search(
            r"(?:du|de\s+l['']\s*|de\s+la\s+|de|d['']\s*)\s*"
            r"([A-ZA-Ua-za-u][A-ZA-Ua-za-u\s''\-]{1,25})",
            text,
            re.IGNORECASE,
        )
        if not m:
            return None
        candidate = m.group(1).strip().rstrip("?!.,;: ")
        skip = {
            "la", "le", "les", "un", "une", "des", "ce", "cette", "mon",
            "football", "foot", "ligue", "saison", "match", "equipe", "joueur",
        }
        if candidate.lower() in skip or len(candidate) < 2:
            return None
        try:
            data = await self._tools.call("get_team_info", {"search": candidate})
            if data and isinstance(data, list) and len(data) > 0:
                team = data[0]
                tid = team.get("id") or team.get("team", {}).get("id")
                if tid:
                    logger.info("prerouter resolved '%s' -> team_id=%s", candidate, tid)
                    return tid
        except Exception:
            logger.debug("team resolution failed for '%s'", candidate, exc_info=True)
        return None

    async def try_route(self, req: IncomingRequest) -> Response | None:
        """Renvoie une Response si la requete matche un pattern, sinon None."""
        # Auto-resolution du nom d'equipe dans le texte
        if not req.context.team_id and not req.context.fixture_id:
            resolved = await self._resolve_team_id(req)
            if resolved:
                ctx = req.context.model_copy(update={"team_id": resolved})
                req = req.model_copy(update={"context": ctx})

        text = req.text.strip().lower()

        # Salutations
        if _GREETING_RE.search(text):
            return Response(
                text="Salut ! Je suis Oria, ton assistant football. "
                "Comment puis-je t'aider ?",
                suggested_actions=[
                    SuggestedAction(label="Classement Ligue 1", payload={"text": "classement ligue 1"}),
                    SuggestedAction(label="Prochain match PSG", payload={"text": "prochain match du PSG"}),
                ],
            )

        # Accusés de réception (merci, ok, ça va...)  [F0]
        if _ACK_RE.search(text):
            return Response(
                text="Avec plaisir ! N'hésite pas si tu as d'autres questions.",
            )

        # Aide
        if _HELP_RE.search(text):
            return Response(
                text="Je peux t'aider avec les classements, résultats, matchs à venir, "
                "compositions, blessures et plus encore. Pose-moi ta question !",
            )

        # Garde méta-intent : questions pédagogiques et signalements  [S4, S5]
        # -> laisser passer à l'orchestrateur
        if _META_INTENT_RE.search(text):
            return None

        # Famille A : classement
        if re.search(r"\b(classement|standings?)\b", text, re.IGNORECASE):
            return await self._handle_standings(req)

        # Famille A : prochain match  [A2 élargi]
        if re.search(
            r"\b(prochain\s+match|next\s+match|quand\s+joue|"
            r"c[''']est\s+quand\s+le\s+prochain)\b",
            text, re.IGNORECASE,
        ):
            return await self._handle_next_match(req)

        # Famille A : dernier résultat  [S1 : score retiré]
        if re.search(r"\b(dernier\s+r[eé]sultat|last\s+result)\b", text, re.IGNORECASE):
            return await self._handle_last_result(req)

        # Famille A : forme récente
        if re.search(r"\b(forme|form)\b", text, re.IGNORECASE):
            return await self._handle_form(req)

        # Famille A : calendrier
        if re.search(r"\b(calendrier|programme|schedule)\b", text, re.IGNORECASE):
            return await self._handle_schedule(req)

        # Famille A : matchs (génériques)  [S2 : exclusion notif/analyse]
        if (
            re.search(r"\b(matchs?|fixtures?|rencontres?)\b", text, re.IGNORECASE)
            and not _NOTIF_ANALYSIS_RE.search(text)
        ):
            return await self._handle_matches(req)

        # Famille B : compositions / lineups (AVANT joueurs pour ne pas capturer "compo")
        if re.search(
            r"\b(compos?|compositions?|onze|titulaires?|lineups?)\b",
            text, re.IGNORECASE,
        ):
            result = await self._handle_lineups(req)
            if result:
                return result

        # Famille B : résumé de match
        if re.search(
            r"\b(r[eé]sum[eé]\s+(?:du\s+)?match|faits?\s+de\s+match|"
            r"que\s+s[''']est[- ]il\s+pass[eé]|d[eé]roul[eé])\b",
            text, re.IGNORECASE,
        ):
            result = await self._handle_match_summary(req)
            if result:
                return result

        # Famille B : blessures
        if re.search(r"\b(blessures?|injur|bless[eé]s?)\b", text, re.IGNORECASE):
            return await self._handle_injuries(req)

        # Famille B : joueurs / stats
        if re.search(r"\b(joueurs?|players?|effectif|stats?\b)", text, re.IGNORECASE):
            return await self._handle_players(req)

        # Famille B : comparaison → orchestrateur (ne pas capturer en team_info)
        if re.search(
            r"\b(plus\s+fort|comparer|comparaison|qui\s+(?:est|serait)\s+(?:le\s+)?(?:meilleur|plus\s+fort))\b",
            text, re.IGNORECASE,
        ) or re.search(r"\bou\b.+\bqui\b", text, re.IGNORECASE):
            return None

        # Famille B : infos équipe
        if re.search(r"\b(infos?|informations?|qui\s+est)\b", text, re.IGNORECASE):
            return await self._handle_team_info(req)

        # Famille C : scores en direct
        if re.search(r"\b(en\s+direct|live|en\s+cours|score.+en\s+ce\s+moment)\b", text, re.IGNORECASE):
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

            # Disambiguation F4 : league_id requis pour get_standings
            if "league_id" not in params:
                return Response(
                    text="De quel championnat veux-tu le classement ?",
                    suggested_actions=[
                        SuggestedAction(label="Ligue 1", payload={"text": "classement ligue 1"}),
                        SuggestedAction(label="Premier League", payload={"text": "classement Premier League"}),
                        SuggestedAction(label="La Liga", payload={"text": "classement La Liga"}),
                        SuggestedAction(label="Serie A", payload={"text": "classement Serie A"}),
                        SuggestedAction(label="Bundesliga", payload={"text": "classement Bundesliga"}),
                    ],
                )

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
            params: dict[str, Any] = {}
            if req.context.fixture_id:
                params["fixture_id"] = req.context.fixture_id
            else:
                params["next"] = 1
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
            params: dict[str, Any] = {}
            if req.context.fixture_id:
                params["fixture_id"] = req.context.fixture_id
            else:
                params["last"] = 1
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
            params: dict[str, Any] = {}
            if req.context.fixture_id:
                params["fixture_id"] = req.context.fixture_id
            else:
                params["next"] = 5
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
            if req.context.fixture_id:
                params["fixture_id"] = req.context.fixture_id
            else:
                if req.context.team_id:
                    params["team_id"] = req.context.team_id
                    params["next"] = 5
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

    async def _handle_lineups(self, req: IncomingRequest) -> Response | None:
        """Compositions : exige fixture_id, sinon renvoie None (orchestrateur)."""
        if self._tools is None:
            return None
        if not req.context.fixture_id:
            return None
        try:
            data = await self._tools.call(
                "get_lineups", {"fixture_id": req.context.fixture_id},
            )
            if data:
                return Response(
                    text="Voici les compositions.",
                    attachments=[Attachment(kind="table", data={"lineups": data})],
                )
        except Exception:
            logger.debug("prerouter lineups failed", exc_info=True)
        return None

    async def _handle_match_summary(self, req: IncomingRequest) -> Response | None:
        """Résumé de match : exige fixture_id, sinon renvoie None (orchestrateur)."""
        if self._tools is None:
            return None
        if not req.context.fixture_id:
            return None
        try:
            fid = req.context.fixture_id
            events = await self._tools.call("get_match_events", {"fixture_id": fid})
            stats = await self._tools.call("get_match_statistics", {"fixture_id": fid})
            if events or stats:
                return Response(
                    text="Voici le résumé du match.",
                    attachments=[
                        Attachment(kind="table", data={"events": events or []}),
                        Attachment(kind="table", data={"statistics": stats or []}),
                    ],
                )
        except Exception:
            logger.debug("prerouter match summary failed", exc_info=True)
        return None

    async def _handle_players(self, req: IncomingRequest) -> Response | None:
        if self._tools is None:
            return None
        try:
            if req.context.player_id:
                # Joueur spécifique → stats individuelles
                params: dict[str, Any] = {"player_id": req.context.player_id}
                if req.context.league_id:
                    params["league_id"] = req.context.league_id
                if req.context.season:
                    params["season"] = req.context.season
                data = await self._tools.call("get_player_stats", params)
                if data:
                    return Response(
                        text="Voici les statistiques du joueur.",
                        attachments=[Attachment(kind="table", data={"players": data})],
                    )
            elif req.context.team_id:
                # Équipe sans joueur spécifique → effectif complet
                data = await self._tools.call(
                    "get_squad", {"team_id": req.context.team_id},
                )
                if data:
                    return Response(
                        text="Voici l'effectif de l'équipe.",
                        attachments=[Attachment(kind="table", data={"squad": data})],
                    )
            else:
                # Pas de contexte suffisant → passer à l'orchestrateur
                return None
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
        # Gating C1-C5 : vérifier l'entitlement live_realtime
        if self._entitlements is not None:
            try:
                from oria.app.entitlements.models import DecisionKind
                decision = await self._entitlements.check(req.user_id, "live_realtime")
                if decision.kind != DecisionKind.ALLOW:
                    return Response(
                        text=decision.reason,
                        degraded=True,
                        suggested_actions=[
                            SuggestedAction(label="Passer Premium", payload={"action": "upgrade"}),
                        ],
                    )
            except Exception:
                logger.debug("live entitlement check failed", exc_info=True)
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
            # S3 : message explicite quand aucun match en direct
            return Response(
                text="Aucun match en direct pour le moment.",
                suggested_actions=[
                    SuggestedAction(label="Prochains matchs", payload={"text": "prochains matchs"}),
                ],
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
                # fixture_id exclusif : ne PAS envoyer league_id sinon l'API
                # renvoie les cotes de toute la ligue.
                params["fixture_id"] = req.context.fixture_id
            else:
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
