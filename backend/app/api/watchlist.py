"""Watchlist routes: list, add (idempotent), remove."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app import db
from app.market import MarketDataSource, PriceCache
from app.services import watchlist as watchlist_service

from .deps import get_market_source, get_price_cache

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])

CacheDep = Annotated[PriceCache, Depends(get_price_cache)]
SourceDep = Annotated[MarketDataSource, Depends(get_market_source)]


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("")
async def get_watchlist(cache: CacheDep) -> dict:
    with db.connect() as conn:
        return {"watchlist": watchlist_service.build_watchlist(conn, cache)}


@router.post("", status_code=201)
async def add_to_watchlist(
    body: AddTickerRequest, cache: CacheDep, source: SourceDep
) -> JSONResponse:
    entry, created = await watchlist_service.add_ticker(cache, source, body.ticker)
    return JSONResponse(entry, status_code=201 if created else 200)


@router.delete("/{ticker}", status_code=204)
async def remove_from_watchlist(ticker: str, cache: CacheDep, source: SourceDep) -> Response:
    await watchlist_service.remove_ticker(cache, source, ticker)
    return Response(status_code=204)
