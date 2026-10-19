"""Deterministic mock rules (TEAM_CONTRACT §5)."""

import pytest

from app.llm.mock import mock_response

PORTFOLIO = {"total_value": 12345.6, "cash_balance": 850.0}


def _summary(r):
    return (
        r.message,
        [(t.ticker, t.side, t.quantity) for t in r.trades],
        [(c.ticker, c.action) for c in r.watchlist_changes],
    )


@pytest.mark.parametrize(
    "text, expected",
    [
        (
            "Buy 5 shares of pypl",
            ("[mock] Buying 5 shares of PYPL.", [("PYPL", "buy", 5)], [("PYPL", "add")]),
        ),
        ("please BUY 2 aapl now", ("[mock] Buying 2 shares of AAPL.", [("AAPL", "buy", 2)], [("AAPL", "add")])),
        ("buy 1 share brk.b", ("[mock] Buying 1 shares of BRK.B.", [("BRK.B", "buy", 1)], [("BRK.B", "add")])),
        ("Sell 3 shares TSLA", ("[mock] Selling 3 shares of TSLA.", [("TSLA", "sell", 3)], [])),
        ("add nflx", ("[mock] Adding NFLX to your watchlist.", [], [("NFLX", "add")])),
        ("Watch amd please", ("[mock] Adding AMD to your watchlist.", [], [("AMD", "add")])),
        ("remove jpm", ("[mock] Removing JPM from your watchlist.", [], [("JPM", "remove")])),
        (
            "How am I doing?",
            ("[mock] Your portfolio is worth $12,345.60 with $850.00 in cash.", [], []),
        ),
    ],
)
def test_rules(text, expected):
    assert _summary(mock_response(text, PORTFOLIO)) == expected


def test_first_rule_wins():
    # Both buy and remove match; buy comes first in the table.
    r = mock_response("remove v and buy 4 meta", PORTFOLIO)
    assert _summary(r)[1] == [("META", "buy", 4)]


def test_buy_without_quantity_falls_through():
    assert _summary(mock_response("buy aapl", PORTFOLIO))[1] == []
