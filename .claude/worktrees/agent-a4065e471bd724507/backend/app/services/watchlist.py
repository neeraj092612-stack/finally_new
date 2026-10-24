"""Watchlist queries and live-price entries."""

from __future__ import annotations

import sqlite3

from app.db import USER_ID
from app.market import PriceCache


def list_tickers(conn: sqlite3.Connection) -> list[str]:
    """Return watched tickers in the order they were added."""
    # rowid breaks ties: the 10 seed rows share one added_at second.
    rows = conn.execute(
        "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at, rowid",
        (USER_ID,),
    ).fetchall()
    return [row["ticker"] for row in rows]


def watchlist_entry(ticker: str, added_at: str, cache: PriceCache) -> dict:
    """Build one API watchlist entry; price fields are None (never 0) while unpriced."""
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
    return {
        "ticker": ticker,
        "price": update.price,
        "previous_price": update.previous_price,
        "direction": update.direction,
        "day_change_percent": update.day_change_percent,
        "added_at": added_at,
    }


def list_entries(conn: sqlite3.Connection, cache: PriceCache) -> list[dict]:
    """Return every watched ticker with its latest cached price, oldest first."""
    rows = conn.execute(
        "SELECT ticker, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at, rowid",
        (USER_ID,),
    ).fetchall()
    return [watchlist_entry(row["ticker"], row["added_at"], cache) for row in rows]
