"""Mapper JSON brut → modèles domaine (stub M3)."""

from __future__ import annotations

from typing import Any


def map_fixtures(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit la réponse API-Football en format domaine."""
    result: list[dict[str, Any]] = raw.get("response", [])
    return result


def map_standings(raw: dict[str, Any]) -> list[dict[str, Any]]:
    """Convertit les classements."""
    result: list[dict[str, Any]] = raw.get("response", [])
    return result
