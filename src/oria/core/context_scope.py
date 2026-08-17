"""Scope resolution from Context — deterministic helper for prerouter."""

from __future__ import annotations

from enum import Enum

from oria.kernel.models import Context


class Scope(str, Enum):
    NONE = "none"
    LEAGUE = "league"
    TEAM = "team"
    FIXTURE = "fixture"
    PLAYER = "player"


def scope_of(ctx: Context) -> Scope:
    """Specificite semantique decroissante : player > fixture > team > league."""
    if ctx.player_id:
        return Scope.PLAYER
    if ctx.fixture_id:
        return Scope.FIXTURE
    if ctx.team_id:
        return Scope.TEAM
    if ctx.league_id:
        return Scope.LEAGUE
    return Scope.NONE


def describe(ctx: Context) -> str:
    """Genere une description structuree du cadre pour le system prompt."""
    parts: list[str] = []
    if ctx.league_id:
        parts.append(f"league_id={ctx.league_id}")
    if ctx.fixture_id:
        parts.append(f"fixture_id={ctx.fixture_id}")
    if ctx.team_id:
        parts.append(f"team_id={ctx.team_id}")
    if ctx.player_id:
        parts.append(f"player_id={ctx.player_id}")
    if ctx.season:
        parts.append(f"season={ctx.season}")

    if not parts:
        return ""

    scope = scope_of(ctx)
    ids_line = "IDs résolus : " + ", ".join(parts)

    rules = [
        "- Ce cadre est un contexte par défaut, pas une contrainte absolue.",
        "- Ne re-résous jamais une entité dont l'ID est fourni ci-dessus.",
        "- Passe ces IDs directement aux outils sans les re-résoudre.",
    ]

    if scope == Scope.PLAYER:
        rules.append("- Les questions sans sujet explicite portent sur ce joueur.")
    elif scope == Scope.FIXTURE:
        rules.append("- Les questions sans sujet explicite portent sur ce match.")
    elif scope == Scope.TEAM:
        rules.append("- Les questions sans sujet explicite portent sur cette équipe.")
    elif scope == Scope.LEAGUE:
        rules.append("- Les questions sans sujet explicite portent sur cette ligue.")

    rules.append(
        "- Si la question porte manifestement sur un niveau plus large, "
        "utilise le niveau approprié même s'il est plus large que le cadre."
    )

    return ids_line + "\nRègles :\n" + "\n".join(rules)
