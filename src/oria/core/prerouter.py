"""Pré-routeur d'intention — répond au trivial sans LLM (famille A)."""

from __future__ import annotations

import logging
import re

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import IncomingRequest, Response

logger = logging.getLogger(__name__)

# Patterns simples pour les questions fréquentes (famille A)
_PATTERNS: list[tuple[re.Pattern[str], str]] = [
    (
        re.compile(r"\b(bonjour|salut|hello|hey|coucou)\b", re.IGNORECASE),
        "Salut ! Je suis Oria, ton assistant football. Comment puis-je t'aider ?",
    ),
    (
        re.compile(r"\b(aide|help)\b", re.IGNORECASE),
        "Je peux t'aider avec les classements, résultats, matchs à venir, "
        "compositions, blessures et plus encore. Pose-moi ta question !",
    ),
]


class PreRouter:
    """Module optionnel : filtre les requêtes triviales sans LLM."""

    name: str = "prerouter"
    required: bool = False
    provides: tuple[str, ...] = ("prerouting",)

    async def start(self) -> None:
        logger.info("prerouter ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def try_route(self, req: IncomingRequest) -> Response | None:
        """Renvoie une Response si la requête matche un pattern, sinon None."""
        for pattern, reply in _PATTERNS:
            if pattern.search(req.text):
                return Response(text=reply)
        return None
