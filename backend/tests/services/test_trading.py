"""Trade execution rules, position lifecycle and atomicity."""

from __future__ import annotations

import asyncio

import pytest

from app import db
from app.errors import AppError
from app.services.trading import execute_trade


async def _trade(cache, ticker, side, qty):
    return await execute_trade(cache, ticker, side, qty)


def _code(excinfo) -> str:
    return excinfo.value.code


class TestBuy:
    async def test_buy_creates_position_and_debits_cash(self, cache, source):
        result = await _trade(cache, "aapl", "buy", 10)
        trade = result["trade"]
        assert trade["ticker"] == "AAPL"
        assert trade["side"] == "buy"
        assert trade["quantity"] == 10
        assert trade["price"] == 100.0
        assert trade["id"] and trade["executed_at"].endswith("Z")

        portfolio = result["portfolio"]
        assert portfolio["cash_balance"] == 9000.0
        assert portfolio["positions_value"] == 1000.0
        assert portfolio["total_value"] == 10000.0
        [pos] = portfolio["positions"]
        assert pos["ticker"] == "AAPL"
        assert pos["quantity"] == 10
        assert pos["avg_cost"] == 100.0

    async def test_weighted_average_cost(self, cache, source):
        await _trade(cache, "AAPL", "buy", 10)
        cache.update("AAPL", 110.0)
        result = await _trade(cache, "AAPL", "buy", 30)
        [pos] = result["portfolio"]["positions"]
        assert pos["quantity"] == 40
        assert pos["avg_cost"] == pytest.approx((10 * 100 + 30 * 110) / 40)
        assert result["portfolio"]["cash_balance"] == pytest.approx(10000 - 1000 - 3300)

    async def test_insufficient_cash(self, cache, source):
        with pytest.raises(AppError) as exc:
            await _trade(cache, "AAPL", "buy", 101)
        assert _code(exc) == "insufficient_cash"
        assert exc.value.status_code == 400
        assert exc.value.message == "Need $10,100.00 but only $10,000.00 is available."

    async def test_buy_exactly_all_cash(self, cache, source):
        result = await _trade(cache, "AAPL", "buy", 100)
        assert result["portfolio"]["cash_balance"] == 0.0


class TestSell:
    async def test_partial_sell_keeps_avg_cost(self, cache, source):
        await _trade(cache, "AAPL", "buy", 10)
        cache.update("AAPL", 120.0)
        result = await _trade(cache, "AAPL", "sell", 4)
        [pos] = result["portfolio"]["positions"]
        assert pos["quantity"] == 6
        assert pos["avg_cost"] == 100.0
        assert result["portfolio"]["cash_balance"] == 9000.0 + 480.0

    async def test_full_sell_deletes_position(self, cache, source):
        await _trade(cache, "AAPL", "buy", 10)
        result = await _trade(cache, "AAPL", "sell", 10)
        assert result["portfolio"]["positions"] == []
        with db.connect() as conn:
            assert db.get_position(conn, "AAPL") is None

    async def test_sell_at_a_loss(self, cache, source):
        await _trade(cache, "AAPL", "buy", 10)
        cache.update("AAPL", 90.0)
        result = await _trade(cache, "AAPL", "sell", 10)
        assert result["portfolio"]["cash_balance"] == 9900.0
        assert result["portfolio"]["total_value"] == 9900.0

    async def test_sell_more_than_held(self, cache, source):
        await _trade(cache, "AAPL", "buy", 5)
        with pytest.raises(AppError) as exc:
            await _trade(cache, "AAPL", "sell", 6)
        assert _code(exc) == "insufficient_shares"
        assert "5 shares" in exc.value.message

    async def test_sell_without_position(self, cache, source):
        with pytest.raises(AppError) as exc:
            await _trade(cache, "AAPL", "sell", 1)
        assert _code(exc) == "insufficient_shares"
        assert exc.value.status_code == 400


class TestValidation:
    @pytest.mark.parametrize("qty", [0, -1, 1.5, 2.0, "3", True, None])
    async def test_bad_quantity(self, cache, source, qty):
        with pytest.raises(AppError) as exc:
            await _trade(cache, "AAPL", "buy", qty)
        assert _code(exc) == "invalid_request"
        assert exc.value.status_code == 422

    @pytest.mark.parametrize("side", ["BUY", "hold", "", None])
    async def test_bad_side(self, cache, source, side):
        with pytest.raises(AppError) as exc:
            await _trade(cache, "AAPL", side, 1)
        assert _code(exc) == "invalid_request"

    async def test_invalid_ticker(self, cache, source):
        with pytest.raises(AppError) as exc:
            await _trade(cache, "1BAD", "buy", 1)
        assert _code(exc) == "invalid_ticker"

    async def test_ticker_not_watched(self, cache, source):
        with pytest.raises(AppError) as exc:
            await _trade(cache, "PYPL", "buy", 1)
        assert _code(exc) == "ticker_not_watched"
        assert exc.value.status_code == 400

    async def test_price_unavailable(self, cache, source):
        with db.connect() as conn:
            db.add_watchlist_ticker(conn, "ZZZZ")
        with pytest.raises(AppError) as exc:
            await _trade(cache, "ZZZZ", "buy", 1)
        assert _code(exc) == "price_unavailable"
        assert exc.value.status_code == 409

    async def test_not_watched_checked_before_price(self, cache, source):
        # Unwatched and unpriced: watchlist rule comes first.
        with pytest.raises(AppError) as exc:
            await _trade(cache, "ZZZZ", "buy", 1)
        assert _code(exc) == "ticker_not_watched"


class TestSideEffects:
    async def test_trade_row_and_snapshot_written(self, cache, source):
        await _trade(cache, "AAPL", "buy", 3)
        await _trade(cache, "AAPL", "sell", 1)
        with db.connect() as conn:
            trades = db.list_trades(conn)
            snapshots = db.list_snapshots(conn)
        assert [(t["side"], t["quantity"]) for t in trades] == [("buy", 3), ("sell", 1)]
        assert len(snapshots) == 2
        assert snapshots[-1]["total_value"] == 10000.0

    async def test_failed_trade_changes_nothing(self, cache, source):
        with pytest.raises(AppError):
            await _trade(cache, "AAPL", "buy", 1000)
        with db.connect() as conn:
            assert db.get_cash_balance(conn) == 10000.0
            assert db.list_trades(conn) == []
            assert db.list_snapshots(conn) == []
            assert db.list_positions(conn) == []

    async def test_concurrent_trades_are_serialized(self, cache, source):
        # 20 concurrent buys of 5 shares @ $100 can only all succeed; cash must be exact.
        results = await asyncio.gather(
            *[_trade(cache, "AAPL", "buy", 5) for _ in range(20)]
        )
        assert len(results) == 20
        with db.connect() as conn:
            assert db.get_cash_balance(conn) == 0.0
            assert db.get_position(conn, "AAPL")["quantity"] == 100
