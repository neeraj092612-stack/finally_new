"""Portfolio endpoints."""

from __future__ import annotations

from contextlib import closing

from fastapi import APIRouter

from app.config import Settings
from app.db import connect
from app.market import PriceCache
from app.services.portfolio import build_portfolio


def create_portfolio_router(settings: Settings, cache: PriceCache) -> APIRouter:
    """Create the router serving GET /api/portfolio."""
    router = APIRouter(prefix="/api", tags=["portfolio"])

    @router.get("/portfolio")
    def get_portfolio() -> dict:
        """Return cash, positions and totals valued at the latest cached prices."""
        # Own connection per request: sqlite3 connections are thread-bound.
        with closing(connect(settings.db_path)) as conn:
            return build_portfolio(conn, cache)

    return router
