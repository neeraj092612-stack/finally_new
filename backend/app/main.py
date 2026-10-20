"""FastAPI application factory with the startup/shutdown lifespan."""

from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, closing

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.api.health import create_health_router
from app.api.portfolio import create_portfolio_router
from app.api.watchlist import create_watchlist_router
from app.config import Settings
from app.db import connect, init_db
from app.market import PriceCache, create_market_data_source, create_stream_router
from app.services.portfolio import record_snapshot
from app.services.watchlist import list_tickers

logger = logging.getLogger(__name__)


def create_app(settings: Settings | None = None) -> FastAPI:
    """Build the app; run with `uvicorn app.main:create_app --factory`."""
    settings = settings or Settings.from_env()
    cache = PriceCache()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        # Order matters (D-21): the DB must exist before the watchlist can seed the source.
        seeded = init_db(settings.db_path)
        logger.info("Database ready at %s (seeded=%s)", settings.db_path, seeded)
        with closing(connect(settings.db_path)) as conn:
            tickers = list_tickers(conn)
        source = create_market_data_source(cache)
        await source.start(tickers)
        # Snapshot after the source has seeded the cache so held tickers are priced (PLAN section 7).
        with closing(connect(settings.db_path)) as conn:
            record_snapshot(conn, cache)
        app.state.market_source = source
        try:
            yield
        finally:
            await source.stop()

    app = FastAPI(title="FinAlly", lifespan=lifespan)
    app.state.price_cache = cache
    app.state.settings = settings

    app.include_router(create_health_router())
    app.include_router(create_watchlist_router(settings, cache))
    app.include_router(create_portfolio_router(settings, cache))
    app.include_router(create_stream_router(cache))

    # Mounted last so API routes win over the catch-all static mount (PLAT-07).
    # StaticFiles raises on a missing directory, so guard it.
    if settings.static_dir is not None and settings.static_dir.is_dir():
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="static")
    else:
        logger.warning("Static directory %s not found; frontend will not be served", settings.static_dir)

    return app
