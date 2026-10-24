"""SQLite connection helpers and lazy database initialisation."""

from __future__ import annotations

import logging
import sqlite3
import uuid
from contextlib import closing
from datetime import UTC, datetime
from pathlib import Path

from .schema import DEFAULT_TICKERS, SCHEMA_SQL

logger = logging.getLogger(__name__)

# Single-user model: every row carries this value (PLAN section 7); nothing is built around it.
USER_ID = "default"
STARTING_CASH = 10000.0

__all__ = ["DEFAULT_TICKERS", "STARTING_CASH", "USER_ID", "connect", "init_db", "now_iso"]


def connect(path: Path) -> sqlite3.Connection:
    """Open a SQLite connection with row access by name and foreign keys enforced."""
    conn = sqlite3.connect(path, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def now_iso() -> str:
    """Return the current UTC time as an ISO 8601 string, e.g. 2026-10-04T14:03:22Z."""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def init_db(path: Path) -> bool:
    """Create the schema and seed defaults; return True when the database was seeded.

    Seeding is tied to the profile row being newly inserted, so a user-emptied
    watchlist is never re-seeded on restart.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL")
        conn.executescript(SCHEMA_SQL)
        with conn:
            now = now_iso()
            cursor = conn.execute(
                "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
                (USER_ID, STARTING_CASH, now),
            )
            seeded = cursor.rowcount == 1
            if seeded:
                conn.executemany(
                    "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                    [(str(uuid.uuid4()), USER_ID, ticker, now) for ticker in DEFAULT_TICKERS],
                )
    return seeded
