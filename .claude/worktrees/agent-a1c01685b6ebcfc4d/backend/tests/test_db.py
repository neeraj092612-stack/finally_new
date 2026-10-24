"""init_db seeds once, survives restarts and builds the PLAN section 7 schema."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

from app.db import STARTING_CASH, USER_ID, connect, init_db
from app.db.schema import DEFAULT_TICKERS
from app.market.seed_prices import SEED_PRICES
from app.services.watchlist import list_tickers

PLAN_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
PLAN_TABLES = {
    "users_profile",
    "watchlist",
    "positions",
    "trades",
    "portfolio_snapshots",
    "chat_messages",
}


def _tickers(path: Path) -> list[str]:
    with closing(connect(path)) as conn:
        return list_tickers(conn)


def _count(path: Path, table: str) -> int:
    with closing(sqlite3.connect(path)) as conn:
        return conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]


class TestSeeding:
    def test_fresh_database_is_seeded_and_reports_true(self, tmp_path: Path) -> None:
        path = tmp_path / "finally.db"

        assert init_db(path) is True

        with closing(connect(path)) as conn:
            rows = conn.execute("SELECT id, cash_balance FROM users_profile").fetchall()
        assert [(row["id"], row["cash_balance"]) for row in rows] == [(USER_ID, 10000.0)]
        assert STARTING_CASH == 10000.0

    def test_default_watchlist_matches_plan_order(self, tmp_path: Path) -> None:
        path = tmp_path / "finally.db"
        init_db(path)

        assert _tickers(path) == PLAN_TICKERS

    def test_second_init_returns_false_and_changes_nothing(self, tmp_path: Path) -> None:
        path = tmp_path / "finally.db"
        init_db(path)

        assert init_db(path) is False

        assert _count(path, "users_profile") == 1
        assert _count(path, "watchlist") == 10
        assert _tickers(path) == PLAN_TICKERS

    def test_user_deleted_ticker_is_not_reseeded(self, tmp_path: Path) -> None:
        path = tmp_path / "finally.db"
        init_db(path)
        with closing(connect(path)) as conn, conn:
            conn.execute("DELETE FROM watchlist WHERE ticker = 'AAPL'")

        init_db(path)

        assert _count(path, "watchlist") == 9
        assert "AAPL" not in _tickers(path)

    def test_user_emptied_watchlist_stays_empty(self, tmp_path: Path) -> None:
        path = tmp_path / "finally.db"
        init_db(path)
        with closing(connect(path)) as conn, conn:
            conn.execute("DELETE FROM watchlist")

        init_db(path)

        assert _tickers(path) == []

    def test_every_default_ticker_has_a_seed_price(self) -> None:
        assert list(DEFAULT_TICKERS) == PLAN_TICKERS
        assert set(DEFAULT_TICKERS) <= set(SEED_PRICES)


class TestSchema:
    def test_missing_nested_parent_directory_is_created(self, tmp_path: Path) -> None:
        path = tmp_path / "a" / "b" / "finally.db"

        init_db(path)

        assert path.is_file()

    def test_all_six_plan_tables_exist(self, tmp_path: Path) -> None:
        path = tmp_path / "finally.db"
        init_db(path)

        with closing(sqlite3.connect(path)) as conn:
            names = {
                row[0]
                for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
            }

        assert PLAN_TABLES <= names

    def test_journal_mode_is_wal(self, tmp_path: Path) -> None:
        path = tmp_path / "finally.db"
        init_db(path)

        with closing(sqlite3.connect(path)) as conn:
            mode = conn.execute("PRAGMA journal_mode").fetchone()[0]

        assert mode == "wal"
