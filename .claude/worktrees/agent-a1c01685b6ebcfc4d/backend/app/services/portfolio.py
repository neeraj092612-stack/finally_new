"""Portfolio valuation and snapshots."""

from __future__ import annotations

import sqlite3
import uuid

from app.db import USER_ID, now_iso
from app.market import PriceCache


def build_portfolio(conn: sqlite3.Connection, cache: PriceCache) -> dict:
    """Value cash and positions at cached prices, in the PLAN section 8 response shape."""
    profile = conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (USER_ID,)
    ).fetchone()
    cash = profile["cash_balance"]
    rows = conn.execute(
        "SELECT ticker, quantity, avg_cost FROM positions WHERE user_id = ? ORDER BY ticker",
        (USER_ID,),
    ).fetchall()

    positions: list[dict] = []
    positions_value = 0.0
    unrealized_pnl = 0.0
    for row in rows:
        quantity = row["quantity"]
        avg_cost = row["avg_cost"]
        # A held ticker is normally always priced; if not, value it at cost rather than 0
        # so total_value never drops by the whole position.
        price = cache.get_price(row["ticker"])
        current_price = avg_cost if price is None else price
        market_value = quantity * current_price
        pnl = (current_price - avg_cost) * quantity
        pnl_percent = (current_price - avg_cost) / avg_cost * 100 if avg_cost else 0.0
        positions_value += market_value
        unrealized_pnl += pnl
        positions.append(
            {
                "ticker": row["ticker"],
                "quantity": quantity,
                "avg_cost": round(avg_cost, 2),
                "current_price": round(current_price, 2),
                "market_value": round(market_value, 2),
                "unrealized_pnl": round(pnl, 2),
                "unrealized_pnl_percent": round(pnl_percent, 2),
            }
        )

    positions_value = round(positions_value, 2)
    return {
        "cash_balance": round(cash, 2),
        "positions_value": positions_value,
        "total_value": round(cash + positions_value, 2),
        "unrealized_pnl": round(unrealized_pnl, 2),
        "positions": positions,
    }


def record_snapshot(conn: sqlite3.Connection, cache: PriceCache) -> float:
    """Insert one portfolio_snapshots row for the current total value and return it."""
    total_value = build_portfolio(conn, cache)["total_value"]
    with conn:
        conn.execute(
            "INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at) "
            "VALUES (?, ?, ?, ?)",
            (str(uuid.uuid4()), USER_ID, total_value, now_iso()),
        )
    return total_value
