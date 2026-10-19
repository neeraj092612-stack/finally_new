"""Portfolio valuation and snapshots."""

from __future__ import annotations

from app import db
from app.services.portfolio import build_portfolio, record_snapshot


def test_empty_portfolio(cache, source):
    with db.connect() as conn:
        portfolio = build_portfolio(conn, cache)
    assert portfolio == {
        "cash_balance": 10000.0,
        "positions_value": 0.0,
        "total_value": 10000.0,
        "unrealized_pnl": 0.0,
        "positions": [],
    }


def test_valuation_and_pnl(cache, source):
    with db.connect() as conn:
        db.set_cash_balance(conn, 8087.60)
        db.upsert_position(conn, "AAPL", 10, 191.24)
        db.upsert_position(conn, "MSFT", 2, 400.0)
    cache.update("AAPL", 196.24)
    cache.update("MSFT", 380.0)
    with db.connect() as conn:
        portfolio = build_portfolio(conn, cache)

    aapl, msft = portfolio["positions"]  # ordered by ticker
    assert aapl == {
        "ticker": "AAPL",
        "quantity": 10,
        "avg_cost": 191.24,
        "current_price": 196.24,
        "market_value": 1962.40,
        "unrealized_pnl": 50.0,
        "unrealized_pnl_percent": 2.61,
    }
    assert msft["unrealized_pnl"] == -40.0
    assert msft["unrealized_pnl_percent"] == -5.0
    assert portfolio["positions_value"] == 2722.40
    assert portfolio["unrealized_pnl"] == 10.0
    assert portfolio["total_value"] == round(8087.60 + 2722.40, 2)


def test_unpriced_position_falls_back_to_avg_cost(cache, source):
    with db.connect() as conn:
        db.add_watchlist_ticker(conn, "ZZZZ")
        db.upsert_position(conn, "ZZZZ", 4, 50.0)
        portfolio = build_portfolio(conn, cache)
    [pos] = portfolio["positions"]
    assert pos["current_price"] == 50.0
    assert pos["unrealized_pnl"] == 0.0


def test_record_snapshot(cache, source):
    with db.connect() as conn:
        snap = record_snapshot(conn, cache)
        assert snap["total_value"] == 10000.0
        assert db.list_snapshots(conn) == [snap]
