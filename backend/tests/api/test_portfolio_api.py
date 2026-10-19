"""GET /api/portfolio, POST /api/portfolio/trade, GET /api/portfolio/history."""

from __future__ import annotations

import pytest

from .conftest import assert_error

PORTFOLIO_KEYS = {"cash_balance", "positions_value", "total_value", "unrealized_pnl", "positions"}
POSITION_KEYS = {
    "ticker", "quantity", "avg_cost", "current_price", "market_value",
    "unrealized_pnl", "unrealized_pnl_percent",
}
TRADE_KEYS = {"id", "ticker", "side", "quantity", "price", "executed_at"}


def _trade(client, ticker="AAPL", quantity=10, side="buy"):
    return client.post(
        "/api/portfolio/trade", json={"ticker": ticker, "quantity": quantity, "side": side}
    )


def test_get_portfolio_fresh(client):
    r = client.get("/api/portfolio")
    assert r.status_code == 200
    assert r.json() == {
        "cash_balance": 10000.0,
        "positions_value": 0.0,
        "total_value": 10000.0,
        "unrealized_pnl": 0.0,
        "positions": [],
    }


def test_buy_response_shape(client):
    r = _trade(client, "aapl", 10, "buy")
    assert r.status_code == 200
    body = r.json()
    assert set(body) == {"trade", "portfolio"}
    assert set(body["trade"]) == TRADE_KEYS
    assert body["trade"]["ticker"] == "AAPL"
    assert body["trade"]["price"] == 100.0
    assert set(body["portfolio"]) == PORTFOLIO_KEYS
    [pos] = body["portfolio"]["positions"]
    assert set(pos) == POSITION_KEYS
    assert body["portfolio"]["cash_balance"] == 9000.0

    assert client.get("/api/portfolio").json() == body["portfolio"]


def test_buy_then_sell_flow(client, cache):
    _trade(client, "AAPL", 10, "buy")
    cache.update("AAPL", 110.0)
    _trade(client, "AAPL", 10, "buy")
    r = client.get("/api/portfolio").json()
    assert r["positions"][0]["avg_cost"] == 105.0
    assert r["positions"][0]["quantity"] == 20

    r = _trade(client, "AAPL", 5, "sell").json()["portfolio"]
    assert r["positions"][0]["quantity"] == 15
    assert r["positions"][0]["avg_cost"] == 105.0

    r = _trade(client, "AAPL", 15, "sell").json()["portfolio"]
    assert r["positions"] == []
    assert r["cash_balance"] == pytest.approx(10000 - 1000 - 1100 + 20 * 110)


def test_history_has_startup_and_trade_snapshots(client):
    r = client.get("/api/portfolio/history")
    assert r.status_code == 200
    snaps = r.json()["snapshots"]
    assert len(snaps) == 1  # startup snapshot
    assert snaps[0]["total_value"] == 10000.0
    assert snaps[0]["recorded_at"].endswith("Z")

    _trade(client, "AAPL", 1, "buy")
    _trade(client, "AAPL", 1, "sell")
    snaps = client.get("/api/portfolio/history").json()["snapshots"]
    assert len(snaps) == 3
    assert set(snaps[0]) == {"total_value", "recorded_at"}


class TestTradeErrors:
    @pytest.mark.parametrize("quantity", [0, -5, 1.5, 2.0, "3", None, True])
    def test_bad_quantity(self, client, quantity):
        err = assert_error(_trade(client, quantity=quantity), 422, "invalid_request")
        assert "positive whole number" in err["message"]

    @pytest.mark.parametrize("side", ["hold", "BUY", None, 1])
    def test_bad_side(self, client, side):
        assert_error(_trade(client, side=side), 422, "invalid_request")

    def test_missing_fields(self, client):
        assert_error(client.post("/api/portfolio/trade", json={"ticker": "AAPL"}), 422, "invalid_request")

    def test_malformed_json(self, client):
        r = client.post(
            "/api/portfolio/trade", content=b"{not json", headers={"content-type": "application/json"}
        )
        assert_error(r, 422, "invalid_request")

    def test_invalid_ticker(self, client):
        assert_error(_trade(client, ticker="12$"), 400, "invalid_ticker")

    def test_ticker_not_watched(self, client):
        assert_error(_trade(client, ticker="PYPL"), 400, "ticker_not_watched")

    def test_price_unavailable(self, client):
        # The fake source has no price for ZZZZ.
        assert client.post("/api/watchlist", json={"ticker": "ZZZZ"}).status_code == 201
        assert_error(_trade(client, ticker="ZZZZ"), 409, "price_unavailable")

    def test_insufficient_cash(self, client):
        err = assert_error(_trade(client, quantity=101), 400, "insufficient_cash")
        assert err["message"] == "Need $10,100.00 but only $10,000.00 is available."

    def test_insufficient_shares(self, client):
        assert_error(_trade(client, side="sell", quantity=1), 400, "insufficient_shares")
        _trade(client, quantity=2)
        assert_error(_trade(client, side="sell", quantity=3), 400, "insufficient_shares")

    def test_failed_trade_leaves_state(self, client):
        assert_error(_trade(client, quantity=1000), 400, "insufficient_cash")
        assert client.get("/api/portfolio").json()["cash_balance"] == 10000.0
        assert len(client.get("/api/portfolio/history").json()["snapshots"]) == 1
