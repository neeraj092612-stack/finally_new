"""Tests for the watchlist service: ordered entries joined with live cache prices."""

from __future__ import annotations

import sqlite3
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path

import pytest

from app.db import connect, init_db
from app.db.schema import DEFAULT_TICKERS
from app.market import PriceCache
from app.services.watchlist import list_entries, list_tickers, watchlist_entry


@pytest.fixture
def conn(tmp_path: Path) -> Iterator[sqlite3.Connection]:
    db_path = tmp_path / "finally.db"
    init_db(db_path)
    with closing(connect(db_path)) as connection:
        yield connection


def test_watchlist_entry_reports_price_direction_and_day_change() -> None:
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.update("AAPL", 191.24)
    entry = watchlist_entry("AAPL", "2026-10-20T00:00:00Z", cache)
    assert entry == {
        "ticker": "AAPL",
        "price": 191.24,
        "previous_price": 190.0,
        "direction": "up",
        "day_change_percent": 0.65,
        "added_at": "2026-10-20T00:00:00Z",
    }


def test_watchlist_entry_for_unpriced_ticker_has_null_price_fields_not_zero() -> None:
    entry = watchlist_entry("PYPL", "2026-10-20T00:00:00Z", PriceCache())
    assert entry["price"] is None
    assert entry["previous_price"] is None
    assert entry["direction"] is None
    assert entry["day_change_percent"] is None
    assert entry["ticker"] == "PYPL"
    assert entry["added_at"] == "2026-10-20T00:00:00Z"


def test_list_entries_returns_seeded_tickers_in_order(conn: sqlite3.Connection) -> None:
    cache = PriceCache()
    for ticker in DEFAULT_TICKERS:
        cache.update(ticker, 100.0)
    entries = list_entries(conn, cache)
    assert [entry["ticker"] for entry in entries] == list(DEFAULT_TICKERS)
    assert all(entry["price"] == 100.0 for entry in entries)


def test_list_entries_is_empty_when_nothing_is_watched(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute("DELETE FROM watchlist")
    assert list_entries(conn, PriceCache()) == []


def test_identical_added_at_rows_come_back_in_insertion_order(conn: sqlite3.Connection) -> None:
    with conn:
        conn.execute("DELETE FROM watchlist")
        conn.executemany(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', ?, ?)",
            [("id-z", "ZZZ", "2026-10-20T00:00:00Z"), ("id-a", "AAA", "2026-10-20T00:00:00Z")],
        )
    assert list_tickers(conn) == ["ZZZ", "AAA"]
    assert [e["ticker"] for e in list_entries(conn, PriceCache())] == ["ZZZ", "AAA"]
