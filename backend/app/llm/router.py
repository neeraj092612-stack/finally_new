"""Chat API: ``POST /api/chat`` and ``GET /api/chat``."""

from __future__ import annotations

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.errors import AppError

from .chat import handle_chat, list_history

router = APIRouter(prefix="/api/chat", tags=["chat"])

HISTORY_PAGE_SIZE = 50


class ChatRequest(BaseModel):
    message: str


@router.post("")
async def post_chat(body: ChatRequest, request: Request) -> dict:
    text = body.message.strip()
    if not text:
        raise AppError("invalid_request", "Message cannot be empty.", 422)
    state = request.app.state
    return await handle_chat(text, state.price_cache, state.market_source)


@router.get("")
async def get_chat() -> dict:
    return {"messages": list_history(HISTORY_PAGE_SIZE)}
