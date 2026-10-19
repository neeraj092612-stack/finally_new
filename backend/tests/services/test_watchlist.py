"""Watchlist view, add/remove, ticker normalization and day change baseline."""

from __future__ import annotations

import pytest

from app import db
from app.errors import AppError
from app.services import watchlist as ws
from app.services.tickers import normalize_ticker
from app.services.trading import execute_trade


class TestNormalize:
    @pytest.mark.parametrize(
        "raw, expected",
        [("aapl", "AAPL"), ("  msft ", "MSFT"), ("brk.b", "BRK.B"), ("X", "X"), ("A123456789", "A123456789")],
    )
    def test_valid(self, raw, expected):
        assert normalize_ticker(raw) == expected

    @pytest.mark.parametrize("raw", ["", "   ", "1ABC", ".A", "AB-C", "ABCDEFGHIJK", "A B", None, 5])
    def test_invalid(self, raw):
        with pytest.raises(AppError) as exc:
            normalize_ticker(raw)
        assert exc.value.code == "invalid_ticker"
        assert exc.value.status_code == 400


class TestBuildWatchlist:
    def test_default_order_and_shape(self, cache, source):
        with db.connect() as conn:
            entries = ws.build_watchlist(conn, cache)
        assert [e["ticker"] for e in entries] == db.DEFAULT_TICKERS
        first = entries[0]
        assert set(first) == {
            "ticker", "price", "previous_price", "direction", "day_change_percent", "added_at",
        }
        assert first["price"] == 100.0
        assert first["direction"] == "flat"
        assert first["day_change_percent"] == 0.0

    def test_day_change_against_first_price(self, cache, source):
        with db.connect() as conn:
            ws.build_watchlist(conn, cache)  # records baselines
        cache.update("AAPL", 100.65)
        cache.update("AAPL", 101.30)
        with db.connect() as conn:
            aapl = ws.build_watchlist(conn, cache)[0]
        assert aapl["price"] == 101.30
        assert aapl["previous_price"] == 100.65
        assert aapl["direction"] == "up"
        assert aapl["day_change_percent"] == 1.3

    def test_prime_baselines_uses_startup_prices(self, cache, source):
        ws.prime_baselines(cache)
        cache.update("TSLA", 225.0)
        with db.connect() as conn:
            tsla = next(e for e in ws.build_watchlist(conn, cache) if e["ticker"] == "TSLA")
        assert tsla["day_change_percent"] == -10.0

    def test_unpriced_entry_has_nulls(self, cache, source):
        with db.connect() as conn:
            db.add_watchlist_ticker(conn, "ZZZZ")
            entry = ws.build_watchlist(conn, cache)[-1]
        assert entry["ticker"] == "ZZZZ"
        assert entry["price"] is None
        assert entry["previous_price"] is None
        assert entry["direction"] is None
        assert entry["day_change_percent"] is None


class TestAdd:
    async def test_add_new_ticker(self, cache, source):
        entry, created = await ws.add_ticker(cache, source, " pypl ")
        assert created is True
        assert entry["ticker"] == "PYPL"
        assert entry["price"] == 70.0
        assert "PYPL" in source.get_tickers()

    async def test_add_is_idempotent(self, cache, source):
        await ws.add_ticker(cache, source, "PYPL")
        entry, created = await ws.add_ticker(cache, source, "pypl")
        assert created is False
        assert entry["ticker"] == "PYPL"
        assert source.get_tickers().count("PYPL") == 1

    async def test_add_invalid(self, cache, source):
        with pytest.raises(AppError) as exc:
            await ws.add_ticker(cache, source, "no way")
        assert exc.value.code == "invalid_ticker"


class TestRemove:
    async def test_remove(self, cache, source):
        await ws.remove_ticker(cache, source, "nflx")
        assert "NFLX" not in source.get_tickers()
        assert cache.get("NFLX") is None
        with db.connect() as conn:
            assert not db.is_watched(conn, "NFLX")

    async def test_remove_not_watched(self, cache, source):
        with pytest.raises(AppError) as exc:
            await ws.remove_ticker(cache, source, "PYPL")
        assert exc.value.code == "not_watched"
        assert exc.value.status_code == 404

    async def test_remove_with_open_position(self, cache, source):
        await execute_trade(cache, "AAPL", "buy", 1)
        with pytest.raises(AppError) as exc:
            await ws.remove_ticker(cache, source, "AAPL")
        assert exc.value.code == "position_open"
        assert exc.value.status_code == 409
        assert "AAPL" in source.get_tickers()
        with db.connect() as conn:
            assert db.is_watched(conn, "AAPL")

    async def test_remove_after_full_sell(self, cache, source):
        await execute_trade(cache, "AAPL", "buy", 1)
        await execute_trade(cache, "AAPL", "sell", 1)
        await ws.remove_ticker(cache, source, "AAPL")
        with db.connect() as conn:
            assert not db.is_watched(conn, "AAPL")
