"""Watchlist queries."""

from __future__ import annotations

import sqlite3

from app.db import USER_ID


def list_tickers(conn: sqlite3.Connection) -> list[str]:
    """Return watched tickers in the order they were added."""
    # rowid breaks ties: the 10 seed rows share one added_at second.
    rows = conn.execute(
        "SELECT ticker FROM watchlist WHERE user_id = ? ORDER BY added_at, rowid",
        (USER_ID,),
    ).fetchall()
    return [row["ticker"] for row in rows]
