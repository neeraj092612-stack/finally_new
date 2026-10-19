"""Trade execution: market orders, whole shares, instant fill at the cached price."""

from __future__ import annotations

import asyncio

from app import db
from app.errors import AppError, format_money
from app.market import PriceCache

from .portfolio import build_portfolio, record_snapshot
from .tickers import normalize_ticker

# Serializes every trade (manual or LLM-initiated) and watchlist removal.
TRADE_LOCK = asyncio.Lock()

SIDES = ("buy", "sell")


def _validate_order(side: object, quantity: object) -> None:
    if side not in SIDES:
        raise AppError("invalid_request", 'Side must be "buy" or "sell".', 422)
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity <= 0:
        raise AppError("invalid_request", "Quantity must be a positive whole number of shares.", 422)


def _shares(n: int) -> str:
    return f"{n} share" if n == 1 else f"{n} shares"


async def execute_trade(cache: PriceCache, raw_ticker: str, side: str, quantity: int) -> dict:
    """Execute a market order. Returns ``{"trade": {...}, "portfolio": {...}}``.

    Checks, in order: side/quantity, ticker format, watchlist membership, cached price,
    then cash (buy) or held shares (sell). Cash, position, trade row and snapshot are written
    in one transaction while holding ``TRADE_LOCK``.
    """
    _validate_order(side, quantity)
    ticker = normalize_ticker(raw_ticker)

    async with TRADE_LOCK:
        with db.connect() as conn:
            if not db.is_watched(conn, ticker):
                raise AppError(
                    "ticker_not_watched",
                    f"{ticker} is not on your watchlist. Add it before trading.",
                    400,
                )
            price = cache.get_price(ticker)
            if price is None:
                raise AppError(
                    "price_unavailable",
                    f"No price is available for {ticker} yet. Try again in a moment.",
                    409,
                )

            cash = db.get_cash_balance(conn)
            position = db.get_position(conn, ticker)
            held = position["quantity"] if position else 0
            amount = round(quantity * price, 2)

            if side == "buy":
                if amount > cash + 1e-9:
                    raise AppError(
                        "insufficient_cash",
                        f"Need {format_money(amount)} but only {format_money(cash)} is available.",
                        400,
                    )
                new_qty = held + quantity
                old_cost = held * position["avg_cost"] if position else 0.0
                avg_cost = (old_cost + quantity * price) / new_qty
                db.set_cash_balance(conn, round(cash - amount, 2))
                db.upsert_position(conn, ticker, new_qty, avg_cost)
            else:
                if quantity > held:
                    message = (
                        f"You hold {_shares(held)} of {ticker} and cannot sell {quantity}."
                        if held
                        else f"You don't hold any shares of {ticker}."
                    )
                    raise AppError("insufficient_shares", message, 400)
                db.set_cash_balance(conn, round(cash + amount, 2))
                if quantity == held:
                    db.delete_position(conn, ticker)
                else:
                    db.upsert_position(conn, ticker, held - quantity, position["avg_cost"])

            trade = db.insert_trade(conn, ticker, side, quantity, price)
            record_snapshot(conn, cache)
            portfolio = build_portfolio(conn, cache)

    return {"trade": trade, "portfolio": portfolio}
