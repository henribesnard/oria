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

# Patterns qui contiennent "match" sans être un intent de liste de matchs.
# Exclut : cotes pre-match, stats du match, plus fort avant le match, etc.
_MATCH_MODIFIER_RE = re.compile(
    r"\b(cotes?|odds?|pronostics?|"
    r"plus\s+fort|comparer|comparaison|"
    r"pre[- ]match|avant\s+le\s+match|"
    r"stats?\s+(?:du|de|d['']\s*)\s*match)\b",
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
                    return int(tid)
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
                    SuggestedAction(
                        label="Classement Ligue 1",
                        payload={"text": "classement ligue 1"},
                    ),
                    SuggestedAction(
                        label="Prochain match PSG",
                        payload={"text": "prochain match du PSG"},
                    ),
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

        # Famille A : prochain match / horaire du match  [A2 élargi]
        if re.search(
            r"\b(prochain\s+match|next\s+match|quand\s+joue|"
            r"c[''']est\s+quand\s+le\s+prochain|"
            r"[àa]\s+quelle\s+heure|quelle\s+heure|"
            r"heure\s+d[ue]|horaire|"
            r"quand\s+(?:d[ée]bute|commence|se\s+joue|est\s+(?:le|ce))|"
            r"(?:le|ce)\s+match\s+(?:est|se\s+joue)\s+quand|"
            r"coup\s+d[''']envoi)\b",
            text, re.IGNORECASE,
        ):
            return await self._handle_next_match(req)

        # Famille A : dernier résultat  [S1 : score retiré]
        if re.search(r"\b(dernier\s+r[eé]sultat|last\s+result)\b", text, re.IGNORECASE):
            return await self._handle_last_result(req)

        # Famille A : forme récente (exclure analyse/résumé qui contiennent "forme")
        if (
            re.search(r"\b(forme|form)\b", text, re.IGNORECASE)
            and not _NOTIF_ANALYSIS_RE.search(text)
        ):
            return await self._handle_form(req)

        # Famille A : calendrier
        if re.search(r"\b(calendrier|programme|schedule)\b", text, re.IGNORECASE):
            return await self._handle_schedule(req)

        # Famille A : statistiques du match (AVANT matchs génériques)
        if re.search(
            r"\bstats?\s+(?:du|de|d['']\s*)\s*match\b", text, re.IGNORECASE,
        ):
            result = await self._handle_match_statistics(req)
            if result:
                return result

        # Famille A : matchs (génériques)  [S2 : exclusions notif/analyse/modifiers]
        if (
            re.search(r"\b(matchs?|fixtures?|rencontres?)\b", text, re.IGNORECASE)
            and not _NOTIF_ANALYSIS_RE.search(text)
            and not _MATCH_MODIFIER_RE.search(text)
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

        # Famille B : "stats des joueurs" → orchestrateur (stats individuelles)
        if re.search(r"\bstats?\b", text, re.IGNORECASE) and re.search(
            r"\b(joueurs?|players?)\b", text, re.IGNORECASE,
        ):
            return None

        # Famille B : "joueurs à surveiller / clés" → orchestrateur (intent analytique)
        if re.search(r"\b(joueurs?|players?)\b", text, re.IGNORECASE) and re.search(
            r"\b(surveiller|[àa]\s+suivre|cl[eé]s?|importants?|danger)\b",
            text, re.IGNORECASE,
        ):
            return None

        # Famille B : joueurs / effectif (sans "stats" ni intent analytique)
        if re.search(r"\b(joueurs?|players?|effectif)\b", text, re.IGNORECASE):
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

        # Famille C : scores en direct (exclure bilan/résumé/analyse → orchestrateur)
        _live_pat = r"\b(en\s+direct|live|en\s+cours|score.+en\s+ce\s+moment)\b"
        if (
            re.search(_live_pat, text, re.IGNORECASE)
            and not _NOTIF_ANALYSIS_RE.search(text)
        ):
            return await self._handle_live(req)

        # Famille B : historique / h2h
        if re.search(
            r"\b(historique|h2h|face\s+[àa]\s+face|confrontations?\s+direct)",
            text, re.IGNORECASE,
        ):
            result = await self._handle_h2h(req)
            if result:
                return result

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
                        SuggestedAction(
                            label="Ligue 1",
                            payload={"text": "classement ligue 1"},
                        ),
                        SuggestedAction(
                            label="Premier League",
                            payload={"text": "classement Premier League"},
                        ),
                        SuggestedAction(
                            label="La Liga",
                            payload={"text": "classement La Liga"},
                        ),
                        SuggestedAction(
                            label="Serie A",
                            payload={"text": "classement Serie A"},
                        ),
                        SuggestedAction(
                            label="Bundesliga",
                            payload={"text": "classement Bundesliga"},
                        ),
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
                # Build context-aware response text
                label = "Voici le prochain match."
                if req.context.fixture_id and isinstance(data, list) and data:
                    fx = data[0]
                    home = fx.get("home", {}).get("name", "")
                    away = fx.get("away", {}).get("name", "")
                    date_str = fx.get("date", "")
                    if home and away:
                        label = f"Voici les informations pour {home} – {away}."
                return Response(
                    text=label,
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
                # Context-aware response text
                if req.context.fixture_id and isinstance(data, list) and data:
                    fx = data[0]
                    home = fx.get("home", {}).get("name", "")
                    away = fx.get("away", {}).get("name", "")
                    if home and away:
                        label = f"Voici le match {home} – {away}."
                    else:
                        label = "Voici le match."
                elif req.context.team_id:
                    label = "Voici les prochains matchs."
                else:
                    label = "Voici les matchs."
                return Response(
                    text=label,
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

    async def _handle_match_statistics(self, req: IncomingRequest) -> Response | None:
        """Statistiques de match (possession, tirs...) : exige fixture_id."""
        if self._tools is None:
            return None
        if not req.context.fixture_id:
            return None
        try:
            data = await self._tools.call(
                "get_match_statistics",
                {"fixture_id": req.context.fixture_id},
            )
            if data:
                return Response(
                    text="Voici les statistiques du match.",
                    attachments=[Attachment(kind="table", data={"statistics": data})],
                )
            # Données vides (match pas encore commencé) : message explicite
            return Response(
                text="Les statistiques de match (possession, tirs, passes…) "
                "ne sont pas encore disponibles — elles seront publiées "
                "après le coup d'envoi.",
            )
        except Exception:
            logger.debug("prerouter match statistics failed", exc_info=True)
        return None

    async def _resolve_team_from_text(self, text: str) -> int | None:
        """Extrait un nom d'equipe du texte et tente de le resoudre en ID."""
        if self._tools is None:
            return None
        m = re.search(
            r"(?:de\s+l['']\s*|de\s+la\s+|du\s+|de\s+|d['']\s*)"
            r"([A-Za-z\u00C0-\u024F][A-Za-z\u00C0-\u024F\s''\-]{1,25})",
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
                    logger.info("resolved team from text '%s' -> team_id=%s", candidate, tid)
                    return int(tid)
        except Exception:
            logger.debug("team text resolution failed for '%s'", candidate, exc_info=True)
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
            else:
                # Tenter de résoudre le nom d'équipe mentionné dans le texte.
                # Cela corrige le cas "away" où le contexte porte le team_id
                # de l'équipe domicile mais le texte nomme l'équipe extérieure.
                team_id = await self._resolve_team_from_text(req.text)
                if not team_id:
                    team_id = req.context.team_id
                if not team_id:
                    # Pas de contexte suffisant → passer à l'orchestrateur
                    return None
                data = await self._tools.call(
                    "get_squad", {"team_id": team_id},
                )
                if data:
                    return Response(
                        text="Voici l'effectif de l'équipe.",
                        attachments=[Attachment(kind="table", data={"squad": data})],
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

    async def _handle_h2h(self, req: IncomingRequest) -> Response | None:
        """Confrontations directes : résout les 2 team_ids via fixture_id."""
        if self._tools is None:
            return None
        if not req.context.fixture_id:
            return None
        try:
            fixture_data = await self._tools.call(
                "get_fixtures", {"fixture_id": req.context.fixture_id},
            )
            if not fixture_data or not isinstance(fixture_data, list):
                return None
            match = fixture_data[0]
            home_id = match.get("home", {}).get("id")
            away_id = match.get("away", {}).get("id")
            if not home_id or not away_id:
                return None
            data = await self._tools.call(
                "get_h2h", {"team_id_1": home_id, "team_id_2": away_id},
            )
            if data:
                return Response(
                    text="Voici les confrontations directes.",
                    attachments=[Attachment(kind="table", data={"h2h": data})],
                )
        except Exception:
            logger.debug("prerouter h2h failed", exc_info=True)
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
                    SuggestedAction(
                        label="Prochains matchs",
                        payload={"text": "prochains matchs"},
                    ),
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
