"""SQLite connection management, schema creation and seeding."""

from __future__ import annotations

import os
import sqlite3
import uuid
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime
from importlib import resources
from pathlib import Path

DEFAULT_USER_ID = "default"
DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
STARTING_CASH = 10000.0

# backend/app/db/connection.py -> parents[3] is the repository root
_DEFAULT_DB_PATH = Path(__file__).resolve().parents[3] / "db" / "finally.db"


def utc_now_iso() -> str:
    """Current UTC time as ``2026-10-04T14:03:22Z`` (seconds precision)."""
    return datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def new_id() -> str:
    return str(uuid.uuid4())


def get_db_path() -> Path:
    """Database file path from ``DB_PATH`` (or the repo default). Creates the parent directory."""
    raw = os.environ.get("DB_PATH", "").strip()
    path = Path(raw) if raw else _DEFAULT_DB_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _resolve(db_path: str | os.PathLike | None) -> Path:
    if db_path is None:
        return get_db_path()
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _open(db_path: str | os.PathLike | None) -> sqlite3.Connection:
    # isolation_level=None: we issue BEGIN/COMMIT ourselves so one `with` block is one transaction.
    conn = sqlite3.connect(_resolve(db_path), isolation_level=None, timeout=10.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


@contextmanager
def connect(db_path: str | os.PathLike | None = None) -> Iterator[sqlite3.Connection]:
    """Open a connection wrapped in one transaction: commit on success, roll back on error."""
    conn = _open(db_path)
    try:
        conn.execute("BEGIN")
        try:
            yield conn
        except BaseException:
            conn.execute("ROLLBACK")
            raise
        conn.execute("COMMIT")
    finally:
        conn.close()


def _schema_sql() -> str:
    return resources.files(__package__).joinpath("schema.sql").read_text(encoding="utf-8")


def init_db(db_path: str | os.PathLike | None = None) -> None:
    """Create missing tables and seed default data if the user profile is absent. Idempotent."""
    conn = _open(db_path)
    try:
        conn.executescript(_schema_sql())
    finally:
        conn.close()

    with connect(db_path) as conn:
        if conn.execute("SELECT COUNT(*) FROM users_profile").fetchone()[0]:
            return
        now = utc_now_iso()
        conn.execute(
            "INSERT INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            (DEFAULT_USER_ID, STARTING_CASH, now),
        )
        conn.executemany(
            "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
            [(new_id(), DEFAULT_USER_ID, ticker, now) for ticker in DEFAULT_TICKERS],
        )
