"""Watchlist view and mutations. Keeps the market data source and price cache in sync."""

from __future__ import annotations

import sqlite3

from app import db
from app.errors import AppError
from app.market import MarketDataSource, PriceCache

from .tickers import normalize_ticker
from .trading import TRADE_LOCK

# Baseline for day_change_percent: the first price seen for each ticker since server start.
_first_prices: dict[str, float] = {}


def prime_baselines(cache: PriceCache) -> None:
    """Record a baseline for every ticker that already has a price (called at startup)."""
    for ticker, update in cache.get_all().items():
        _first_prices.setdefault(ticker, update.price)


def reset_baselines() -> None:
    _first_prices.clear()


def _entry(ticker: str, added_at: str, cache: PriceCache) -> dict:
    update = cache.get(ticker)
    if update is None:
        return {
            "ticker": ticker,
            "price": None,
            "previous_price": None,
            "direction": None,
            "day_change_percent": None,
            "added_at": added_at,
        }
    baseline = _first_prices.setdefault(ticker, update.price)
    day_change = (update.price - baseline) / baseline * 100 if baseline else 0.0
    return {
        "ticker": ticker,
        "price": update.price,
        "previous_price": update.previous_price,
        "direction": update.direction,
        "day_change_percent": round(day_change, 2),
        "added_at": added_at,
    }


def build_watchlist(conn: sqlite3.Connection, cache: PriceCache) -> list[dict]:
    """Watchlist entries in the exact ``GET /api/watchlist`` element shape, by added_at."""
    return [_entry(e["ticker"], e["added_at"], cache) for e in db.list_watchlist(conn)]


async def add_ticker(
    cache: PriceCache, source: MarketDataSource, raw_ticker: str
) -> tuple[dict, bool]:
    """Add a ticker (idempotent). Returns (entry, created)."""
    ticker = normalize_ticker(raw_ticker)
    with db.connect() as conn:
        entry, created = db.add_watchlist_ticker(conn, ticker)
    if ticker not in source.get_tickers():
        await source.add_ticker(ticker)
    return _entry(entry["ticker"], entry["added_at"], cache), created


async def remove_ticker(cache: PriceCache, source: MarketDataSource, raw_ticker: str) -> None:
    """Remove a ticker. Raises ``not_watched`` or ``position_open``."""
    ticker = normalize_ticker(raw_ticker)
    async with TRADE_LOCK:
        with db.connect() as conn:
            if not db.is_watched(conn, ticker):
                raise AppError("not_watched", f"{ticker} is not on your watchlist.", 404)
            if db.get_position(conn, ticker) is not None:
                raise AppError(
                    "position_open",
                    f"You have an open position in {ticker}. Sell it before removing it "
                    "from your watchlist.",
                    409,
                )
            db.remove_watchlist_ticker(conn, ticker)
    await source.remove_ticker(ticker)
    cache.remove(ticker)
    _first_prices.pop(ticker, None)
