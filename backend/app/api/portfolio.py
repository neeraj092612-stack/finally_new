"""Portfolio routes: view, trade, value history."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from app import db
from app.market import PriceCache
from app.services.portfolio import build_portfolio
from app.services.trading import execute_trade

from .deps import get_price_cache

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])

CacheDep = Annotated[PriceCache, Depends(get_price_cache)]


class TradeRequest(BaseModel):
    ticker: str
    quantity: int = Field(strict=True, gt=0)
    side: Literal["buy", "sell"]


@router.get("")
async def get_portfolio(cache: CacheDep) -> dict:
    with db.connect() as conn:
        return build_portfolio(conn, cache)


@router.post("/trade")
async def trade(body: TradeRequest, cache: CacheDep) -> dict:
    return await execute_trade(cache, body.ticker, body.side, body.quantity)


@router.get("/history")
async def get_history() -> dict:
    with db.connect() as conn:
        return {"snapshots": db.list_snapshots(conn)}
