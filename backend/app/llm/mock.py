"""Deterministic mock LLM (``LLM_MOCK=true``), per TEAM_CONTRACT §5."""

from __future__ import annotations

import re

from .schema import ChatResponse, TradeRequest, WatchlistChange

_TICKER = r"([a-z][a-z0-9.]{0,9})\b"
_BUY = re.compile(r"\bbuy\s+(\d+)\s+(?:shares?\s+(?:of\s+)?)?" + _TICKER, re.IGNORECASE)
_SELL = re.compile(r"\bsell\s+(\d+)\s+(?:shares?\s+(?:of\s+)?)?" + _TICKER, re.IGNORECASE)
_ADD = re.compile(r"\b(?:add|watch)\s+" + _TICKER, re.IGNORECASE)
_REMOVE = re.compile(r"\bremove\s+" + _TICKER, re.IGNORECASE)


def mock_response(user_message: str, portfolio: dict) -> ChatResponse:
    """First matching rule wins. Quantity 0 is passed through so execution reports the failure."""
    if m := _BUY.search(user_message):
        qty, ticker = int(m.group(1)), m.group(2).upper()
        return ChatResponse.model_construct(
            message=f"[mock] Buying {qty} shares of {ticker}.",
            trades=[TradeRequest.model_construct(ticker=ticker, side="buy", quantity=qty)],
            watchlist_changes=[WatchlistChange(ticker=ticker, action="add")],
        )
    if m := _SELL.search(user_message):
        qty, ticker = int(m.group(1)), m.group(2).upper()
        return ChatResponse.model_construct(
            message=f"[mock] Selling {qty} shares of {ticker}.",
            trades=[TradeRequest.model_construct(ticker=ticker, side="sell", quantity=qty)],
            watchlist_changes=[],
        )
    if m := _ADD.search(user_message):
        ticker = m.group(1).upper()
        return ChatResponse(
            message=f"[mock] Adding {ticker} to your watchlist.",
            trades=[],
            watchlist_changes=[WatchlistChange(ticker=ticker, action="add")],
        )
    if m := _REMOVE.search(user_message):
        ticker = m.group(1).upper()
        return ChatResponse(
            message=f"[mock] Removing {ticker} from your watchlist.",
            trades=[],
            watchlist_changes=[WatchlistChange(ticker=ticker, action="remove")],
        )
    return ChatResponse(
        message=(
            f"[mock] Your portfolio is worth ${portfolio['total_value']:,.2f} "
            f"with ${portfolio['cash_balance']:,.2f} in cash."
        ),
        trades=[],
        watchlist_changes=[],
    )
