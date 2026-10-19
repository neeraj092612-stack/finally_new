"""FastAPI application: lifespan wiring, error handlers, routers and static frontend.

Run from ``backend/``:  uv run uvicorn app.main:app --port 8000
"""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import db
from app.api import health_router, portfolio_router, watchlist_router
from app.errors import AppError
from app.market import (
    MarketDataSource,
    PriceCache,
    create_market_data_source,
    create_stream_router,
)
from app.services.portfolio import record_snapshot
from app.services.watchlist import prime_baselines, reset_baselines

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_ROOT = BACKEND_DIR.parent

# Root .env; real environment variables win.
load_dotenv(REPO_ROOT / ".env", override=False)

logger = logging.getLogger(__name__)


def get_static_dir() -> Path:
    raw = os.environ.get("STATIC_DIR", "").strip()
    return Path(raw) if raw else BACKEND_DIR / "static"


def _error(code: str, message: str, status_code: int) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status_code)


_FIELD_MESSAGES = {
    "quantity": "Quantity must be a positive whole number of shares.",
    "side": 'Side must be "buy" or "sell".',
    "ticker": "A ticker symbol is required.",
    "message": "A message is required.",
}

_HTTP_CODES = {404: "not_found", 405: "method_not_allowed"}


def _validation_message(exc: RequestValidationError) -> str:
    for err in exc.errors():
        loc = [part for part in err.get("loc", ()) if isinstance(part, str)]
        field = loc[-1] if loc else ""
        if field in _FIELD_MESSAGES:
            return _FIELD_MESSAGES[field]
        if err.get("type") == "json_invalid" or field == "body":
            return "The request body must be valid JSON."
        if field:
            return f"Invalid value for '{field}': {err.get('msg', 'invalid')}."
    return "The request is invalid."


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error_handler(_: Request, exc: AppError) -> JSONResponse:
        return _error(exc.code, exc.message, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _error("invalid_request", _validation_message(exc), 422)

    @app.exception_handler(StarletteHTTPException)
    async def http_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _HTTP_CODES.get(exc.status_code, "http_error")
        return _error(code, str(exc.detail), exc.status_code)

    @app.exception_handler(Exception)
    async def unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("Unhandled error", exc_info=exc)
        return _error("internal_error", "Something went wrong. Please try again.", 500)


def _include_chat_router(app: FastAPI) -> None:
    try:
        from app.llm.router import router as chat_router
    except ModuleNotFoundError as exc:
        # Only tolerate the chat module not existing yet; real import errors propagate.
        if exc.name not in ("app.llm", "app.llm.router"):
            raise
        logger.warning("app.llm.router not found; /api/chat is unavailable")
        return
    app.include_router(chat_router)


def create_app(
    price_cache: PriceCache | None = None,
    market_source: MarketDataSource | None = None,
) -> FastAPI:
    """Build the app. Tests may inject a cache and a (fake) market source."""
    cache = price_cache if price_cache is not None else PriceCache()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        db.init_db()
        source = market_source if market_source is not None else create_market_data_source(cache)
        with db.connect() as conn:
            tickers = db.get_watchlist_tickers(conn)
        await source.start(tickers)
        reset_baselines()
        prime_baselines(cache)
        with db.connect() as conn:
            record_snapshot(conn, cache)

        app.state.price_cache = cache
        app.state.market_source = source
        try:
            yield
        finally:
            await source.stop()

    app = FastAPI(title="FinAlly", lifespan=lifespan)
    install_error_handlers(app)

    app.include_router(health_router)
    app.include_router(portfolio_router)
    app.include_router(watchlist_router)
    app.include_router(create_stream_router(cache))
    _include_chat_router(app)

    # Static frontend last, so every /api route takes precedence.
    static_dir = get_static_dir()
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


app = create_app()
