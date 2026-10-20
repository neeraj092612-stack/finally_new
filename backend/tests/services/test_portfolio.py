"""Tests for portfolio valuation and the startup snapshot."""

from __future__ import annotations

import re
import sqlite3
import uuid
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path

import pytest

from app.db import connect, init_db
from app.market import PriceCache
from app.services.portfolio import build_portfolio, record_snapshot


@pytest.fixture
def conn(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    db_path = tmp_path / "finally.db"
    init_db(db_path)
    with closing(connect(db_path)) as connection:
        yield connection


def _set_cash(conn: sqlite3.Connection, cash: float) -> None:
    with conn:
        conn.execute("UPDATE users_profile SET cash_balance = ? WHERE id = 'default'", (cash,))


def _add_position(conn: sqlite3.Connection, ticker: str, quantity: int, avg_cost: float) -> None:
    with conn:
        conn.execute(
            "INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at) "
            "VALUES (?, 'default', ?, ?, ?, '2026-10-20T00:00:00Z')",
            (str(uuid.uuid4()), ticker, quantity, avg_cost),
        )


def test_fresh_database_is_all_cash(conn: sqlite3.Connection) -> None:
    assert build_portfolio(conn, PriceCache()) == {
        "cash_balance": 10000.0,
        "positions_value": 0.0,
        "total_value": 10000.0,
        "unrealized_pnl": 0.0,
        "positions": [],
    }


def test_plan_section_8_example_is_valued_exactly(conn: sqlite3.Connection) -> None:
    _set_cash(conn, 8087.60)
    _add_position(conn, "AAPL", 10, 191.24)
    cache = PriceCache()
    cache.update("AAPL", 196.24)
    portfolio = build_portfolio(conn, cache)
    assert portfolio["positions"] == [
        {
            "ticker": "AAPL",
            "quantity": 10,
            "avg_cost": 191.24,
            "current_price": 196.24,
            "market_value": 1962.4,
            "unrealized_pnl": 50.0,
            "unrealized_pnl_percent": 2.61,
        }
    ]
    assert portfolio["cash_balance"] == 8087.6
    assert portfolio["positions_value"] == 1962.4
    assert portfolio["total_value"] == 10050.0
    assert portfolio["unrealized_pnl"] == 50.0


def test_held_ticker_without_cached_price_is_valued_at_avg_cost(conn: sqlite3.Connection) -> None:
    _add_position(conn, "MSFT", 2, 400.0)
    _add_position(conn, "AAPL", 10, 191.24)
    cache = PriceCache()
    cache.update("AAPL", 196.24)
    portfolio = build_portfolio(conn, cache)
    assert [p["ticker"] for p in portfolio["positions"]] == ["AAPL", "MSFT"]
    msft = portfolio["positions"][1]
    assert msft["current_price"] == 400.0
    assert msft["market_value"] == 800.0
    assert msft["unrealized_pnl"] == 0.0
    assert msft["unrealized_pnl_percent"] == 0.0


def test_total_value_is_cash_plus_positions_value(conn: sqlite3.Connection) -> None:
    _set_cash(conn, 1234.57)
    _add_position(conn, "AAPL", 3, 100.11)
    _add_position(conn, "NVDA", 7, 33.33)
    cache = PriceCache()
    cache.update("AAPL", 101.37)
    cache.update("NVDA", 31.91)
    portfolio = build_portfolio(conn, cache)
    assert portfolio["total_value"] == round(
        portfolio["cash_balance"] + portfolio["positions_value"], 2
    )


def test_record_snapshot_inserts_one_row_and_returns_total(conn: sqlite3.Connection) -> None:
    total = record_snapshot(conn, PriceCache())
    assert total == 10000.0
    rows = conn.execute("SELECT id, user_id, total_value, recorded_at FROM portfolio_snapshots")
    snapshots = rows.fetchall()
    assert len(snapshots) == 1
    row = snapshots[0]
    assert uuid.UUID(row["id"])
    assert row["user_id"] == "default"
    assert row["total_value"] == 10000.0
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", row["recorded_at"])
