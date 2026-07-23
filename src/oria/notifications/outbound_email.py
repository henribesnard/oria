"""Outbound port email — envoie les notifications par email via MailProvider."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from oria.providers.mail import MailProvider

logger = logging.getLogger(__name__)


class EmailOutboundPort:
    """Envoie des notifications par email (réutilise MailProvider)."""

    def __init__(self, *, mail: MailProvider | None = None) -> None:
        self._mail = mail

    async def send(self, user_id: str, subject: str, body: str) -> None:
        """Envoie un email de notification. Stub : log le contenu."""
        if self._mail is None:
            logger.debug("email port: no mail provider, dropping notification for %s", user_id)
            return
        # En production, on résoudrait l'email de l'utilisateur via IdentityService
        # Pour l'instant, on log via le MailProvider (qui est lui-même un stub)
        await self._mail.send(
            to=f"{user_id}@oria.local",
            subject=subject,
            body=body,
        )
