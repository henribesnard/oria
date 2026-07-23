"""Routes billing : /billing/*."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from oria.adapters.web.dependencies import get_current_user

router = APIRouter(prefix="/billing", tags=["billing"])

_billing_service: Any = None
_entitlements_service: Any = None


def init_billing_routes(
    billing_service: object, entitlements_service: object | None = None,
) -> None:
    global _billing_service, _entitlements_service
    _billing_service = billing_service
    _entitlements_service = entitlements_service


class CheckoutRequest(BaseModel):
    plan: str = "premium"


@router.get("/subscription")
async def get_subscription(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    if _billing_service is None:
        raise HTTPException(status_code=503, detail="billing not available")
    sub = await _billing_service.get_subscription(user["user_id"])
    return sub.model_dump()


@router.post("/checkout")
async def start_checkout(
    req: CheckoutRequest,
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    if _billing_service is None:
        raise HTTPException(status_code=503, detail="billing not available")
    url = await _billing_service.start_checkout(user["user_id"], req.plan)
    return {"checkout_url": url}


@router.post("/portal")
async def open_portal(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, str]:
    if _billing_service is None:
        raise HTTPException(status_code=503, detail="billing not available")
    url = await _billing_service.open_portal(user["user_id"])
    return {"portal_url": url}


@router.post("/webhook")
async def handle_webhook(request: Request) -> dict[str, str]:
    if _billing_service is None:
        raise HTTPException(status_code=503, detail="billing not available")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        await _billing_service.handle_webhook(payload, sig)
        return {"status": "ok"}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/usage")
async def get_usage(
    user: dict[str, str] = Depends(get_current_user),
) -> dict[str, Any]:
    if _entitlements_service is None:
        raise HTTPException(status_code=503, detail="entitlements not available")
    snapshot = await _entitlements_service.usage(user["user_id"])
    return snapshot.model_dump()
