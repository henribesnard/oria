"""MailProvider — stub : logue les emails au lieu de les envoyer."""

from __future__ import annotations

import logging

from oria.kernel.health import Availability, ModuleStatus

logger = logging.getLogger(__name__)


class MailProvider:
    """Fournisseur d'email (stub). En production, branchera sur SMTP/API."""

    name: str = "mail"
    required: bool = False
    provides: tuple[str, ...] = ("mail",)

    def __init__(
        self,
        *,
        smtp_host: str = "",
        smtp_port: int = 587,
        mail_from: str = "noreply@oria.gg",
    ) -> None:
        self._smtp_host = smtp_host
        self._smtp_port = smtp_port
        self._mail_from = mail_from

    async def start(self) -> None:
        logger.info("mail provider ready (stub mode)")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP, detail="stub")

    async def send(self, *, to: str, subject: str, body: str) -> None:
        """Envoie un email. Stub : logue le contenu."""
        logger.info(
            "email sent (stub)",
            extra={"to": to, "subject": subject, "body_length": len(body)},
        )
