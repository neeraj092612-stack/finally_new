"""Portfolio valuation and snapshots."""

from __future__ import annotations

import sqlite3

from app import db
from app.market import PriceCache


def _money(value: float) -> float:
    return round(value, 2)


def build_portfolio(conn: sqlite3.Connection, cache: PriceCache) -> dict:
    """Current portfolio in the exact ``GET /api/portfolio`` shape.

    A held ticker always has a live price (it cannot leave the watchlist), but in Massive
    mode the first poll may not have priced it yet; valuation then falls back to avg_cost.
    """
    cash = db.get_cash_balance(conn)
    positions = []
    positions_value = 0.0
    unrealized_total = 0.0

    for pos in db.list_positions(conn):
        quantity = pos["quantity"]
        avg_cost = pos["avg_cost"]
        price = cache.get_price(pos["ticker"])
        if price is None:
            price = avg_cost
        market_value = quantity * price
        cost_basis = quantity * avg_cost
        pnl = market_value - cost_basis
        positions_value += market_value
        unrealized_total += pnl
        positions.append(
            {
                "ticker": pos["ticker"],
                "quantity": quantity,
                "avg_cost": round(avg_cost, 4),
                "current_price": _money(price),
                "market_value": _money(market_value),
                "unrealized_pnl": _money(pnl),
                "unrealized_pnl_percent": round(pnl / cost_basis * 100, 2) if cost_basis else 0.0,
            }
        )

    return {
        "cash_balance": _money(cash),
        "positions_value": _money(positions_value),
        "total_value": _money(cash + positions_value),
        "unrealized_pnl": _money(unrealized_total),
        "positions": positions,
    }


def record_snapshot(conn: sqlite3.Connection, cache: PriceCache) -> dict:
    """Store the current total portfolio value. Returns ``{total_value, recorded_at}``."""
    return db.insert_snapshot(conn, build_portfolio(conn, cache)["total_value"])
