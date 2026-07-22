"""Hiérarchie d'exceptions Oria."""

from __future__ import annotations


class OriaError(Exception):
    """Racine de toutes les exceptions Oria."""


# --- Kernel / infrastructure ---


class ConfigError(OriaError):
    """Erreur de configuration (clé absente, valeur invalide)."""


class StartupError(OriaError):
    """Un module requis n'a pas pu démarrer."""


# --- Résilience ---


class TimeoutError(OriaError):  # noqa: A001
    """Appel externe expiré."""


class CircuitOpenError(OriaError):
    """Le circuit breaker est ouvert — appel refusé."""


# --- Providers ---


class ProviderError(OriaError):
    """Erreur d'un fournisseur de données externe."""


class QuotaExhaustedError(ProviderError):
    """Budget d'appels API épuisé."""


class UpstreamError(ProviderError):
    """Le service distant a renvoyé une erreur."""


# --- Domaine ---


class DomainError(OriaError):
    """Erreur dans la couche domaine / repository."""


class CacheMissError(DomainError):
    """Aucune donnée en cache (ni fraîche, ni périmée)."""
