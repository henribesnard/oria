"""Adaptateur console — InboundPort + OutboundPort pour le dev/test."""

from __future__ import annotations

import logging

from oria.kernel.health import Availability, ModuleStatus
from oria.kernel.models import IncomingRequest, Response

logger = logging.getLogger(__name__)


class ConsoleAdapter:
    """Canal test/console : lit stdin, envoie vers le pipeline, affiche stdout."""

    name: str = "adapter_console"
    required: bool = False
    provides: tuple[str, ...] = ()

    def __init__(self, *, handle_message: object) -> None:
        # handle_message : Callable[[IncomingRequest], Awaitable[Response]]
        self._handle = handle_message

    async def start(self) -> None:
        logger.info("console adapter ready")

    async def stop(self) -> None:
        pass

    async def health(self) -> ModuleStatus:
        return ModuleStatus(name=self.name, availability=Availability.UP)

    async def send(self, user_id: str, message: Response) -> None:
        """OutboundPort — affiche la réponse."""
        print(f"[{user_id}] {message.text}")  # noqa: T201

    async def run(self) -> None:
        """Boucle interactive (bloquante)."""
        print("Oria console — tapez 'quit' pour quitter.")  # noqa: T201
        while True:
            try:
                text = await _ainput("Vous > ")
            except (EOFError, KeyboardInterrupt):
                break
            if text.strip().lower() in ("quit", "exit", "q"):
                break
            req = IncomingRequest(user_id="console", text=text)
            resp = await self._handle(req)  # type: ignore[operator]
            print(f"Oria > {resp.text}")  # noqa: T201
            if resp.degraded:
                print("  [mode dégradé]")  # noqa: T201


async def _ainput(prompt: str) -> str:
    """input() compatible asyncio (exécuté dans un thread)."""
    import asyncio

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, lambda: input(prompt))
