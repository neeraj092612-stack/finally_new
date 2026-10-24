"""Watchlist endpoints."""

from __future__ import annotations

from contextlib import closing

from fastapi import APIRouter

from app.config import Settings
from app.db import connect
from app.market import PriceCache
from app.services.watchlist import list_entries


def create_watchlist_router(settings: Settings, cache: PriceCache) -> APIRouter:
    """Create the router serving GET /api/watchlist."""
    router = APIRouter(prefix="/api", tags=["watchlist"])

    @router.get("/watchlist")
    def get_watchlist() -> dict[str, list[dict]]:
        """List watched tickers with latest price, direction and Day %."""
        # Own connection per request: sqlite3 connections are thread-bound and sync
        # routes run in a worker thread pool.
        with closing(connect(settings.db_path)) as conn:
            return {"watchlist": list_entries(conn, cache)}

    return router
