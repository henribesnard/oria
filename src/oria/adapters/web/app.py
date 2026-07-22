"""Adaptateur web FastAPI — /health + POST /chat."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel

from oria.kernel.health import Availability, HealthRegistry
from oria.kernel.models import IncomingRequest, Response

app = FastAPI(title="Oria", version="0.1.0")

# Seront injectés au démarrage par main.py
_health_registry: HealthRegistry | None = None
_handle_message: Any = None  # Callable[[IncomingRequest], Awaitable[Response]]


def init_web(*, health: HealthRegistry, handle_message: Any) -> None:  # noqa: ANN401
    """Câble les dépendances depuis le conteneur."""
    global _health_registry, _handle_message  # noqa: PLW0603
    _health_registry = health
    _handle_message = handle_message


# -- Endpoints --


@app.get("/health")
async def health_check() -> dict[str, Any]:
    if _health_registry is None:
        return {"status": "starting"}
    snapshot = _health_registry.snapshot()
    required_down = any(
        s.availability == Availability.DOWN
        for s in snapshot.values()
        # On ne connaît pas required ici, on se base sur le nom
    )
    overall = "degraded" if required_down else "up"
    return {
        "status": overall,
        "modules": {name: s.model_dump() for name, s in snapshot.items()},
    }


class ChatRequest(BaseModel):
    user_id: str = "web"
    text: str


@app.post("/chat")
async def chat(req: ChatRequest) -> dict[str, Any]:
    if _handle_message is None:
        return {"error": "service not ready"}
    incoming = IncomingRequest(user_id=req.user_id, text=req.text)
    resp: Response = await _handle_message(incoming)
    return resp.model_dump()
