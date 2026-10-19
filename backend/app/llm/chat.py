"""Chat orchestration: context -> LLM (or mock) -> auto-executed actions -> stored reply."""

from __future__ import annotations

import os

from app import db
from app.errors import AppError
from app.services import portfolio as portfolio_service
from app.services import trading
from app.services import watchlist as watchlist_service

from .client import call_llm
from .mock import mock_response
from .prompt import HISTORY_LIMIT, build_messages
from .schema import ChatResponse, TradeRequest, WatchlistChange


def _mock_enabled() -> bool:
    return os.environ.get("LLM_MOCK", "").strip().lower() == "true"


def _display_ticker(raw: str) -> str:
    return raw.strip().upper()


async def _apply_watchlist_change(change: WatchlistChange, cache, source) -> dict:
    result = {"ticker": _display_ticker(change.ticker), "action": change.action}
    try:
        if change.action == "add":
            entry, _created = await watchlist_service.add_ticker(cache, source, change.ticker)
            result["ticker"] = entry["ticker"]
        else:
            await watchlist_service.remove_ticker(cache, source, change.ticker)
    except AppError as exc:
        return {**result, "status": "failed", "error": exc.to_dict()}
    return {**result, "status": "executed", "error": None}


async def _apply_trade(trade: TradeRequest, cache) -> dict:
    result = {"ticker": _display_ticker(trade.ticker), "side": trade.side, "quantity": trade.quantity}
    try:
        executed = (await trading.execute_trade(cache, trade.ticker, trade.side, trade.quantity))["trade"]
    except AppError as exc:
        return {**result, "status": "failed", "price": None, "error": exc.to_dict()}
    return {
        **result,
        "ticker": executed["ticker"],
        "status": "executed",
        "price": executed["price"],
        "error": None,
    }


async def run_actions(reply: ChatResponse, cache, source) -> dict:
    """Run actions in the fixed order: watchlist adds, trades (as given), watchlist removals.

    A failed action is recorded and does not stop the ones after it.
    """
    adds = [c for c in reply.watchlist_changes if c.action == "add"]
    removes = [c for c in reply.watchlist_changes if c.action == "remove"]

    watchlist_results = [await _apply_watchlist_change(c, cache, source) for c in adds]
    trade_results = [await _apply_trade(t, cache) for t in reply.trades]
    watchlist_results += [await _apply_watchlist_change(c, cache, source) for c in removes]
    return {"watchlist_changes": watchlist_results, "trades": trade_results}


async def handle_chat(user_message: str, cache, source) -> dict:
    """Store the user message, get a reply, execute its actions, store and return the reply.

    Raises ``AppError("llm_error")`` if the LLM fails; then only the user message is stored.
    """
    with db.connect() as conn:
        history = db.list_chat_messages(conn, limit=HISTORY_LIMIT)
        db.insert_chat_message(conn, "user", user_message, None)
        portfolio = portfolio_service.build_portfolio(conn, cache)
        watchlist = watchlist_service.build_watchlist(conn, cache)

    if _mock_enabled():
        reply = mock_response(user_message, portfolio)
    else:
        reply = await call_llm(build_messages(portfolio, watchlist, history, user_message))

    actions = await run_actions(reply, cache, source)

    with db.connect() as conn:
        stored = db.insert_chat_message(conn, "assistant", reply.message, actions)
    return {"message": stored}


def list_history(limit: int = 50) -> list[dict]:
    with db.connect() as conn:
        return db.list_chat_messages(conn, limit=limit)
