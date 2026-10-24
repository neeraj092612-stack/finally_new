"""Tests for MassiveDataSource and parse_snapshot, built from real Massive models."""

import asyncio
import logging
import time
from unittest.mock import MagicMock, patch

import pytest
from massive.rest.models import TickerSnapshot

from app.market import massive_client
from app.market.cache import PriceCache
from app.market.massive_client import MassiveDataSource

# The MARKET_DATA_DESIGN section 10.2 example: the raw JSON the client deserializes.
RAW_AAPL = {
    "ticker": "AAPL",
    "todaysChangePerc": 0.65,
    "updated": 1791100800120000000,
    "day": {"o": 190.4, "h": 191.9, "l": 189.8, "c": 191.2, "v": 41230000},
    "prevDay": {"o": 188.1, "h": 190.6, "l": 187.9, "c": 190.0, "v": 52011000},
    "min": {"c": 191.22, "t": 1791100740000},
    "lastTrade": {"p": 191.24, "s": 100, "t": 1791100800120000000, "x": 4},
}


def _snap(**overrides) -> TickerSnapshot:
    """Build a real TickerSnapshot from the section 10.2 example with overrides."""
    raw = {**RAW_AAPL, **overrides}
    return TickerSnapshot.from_dict(raw)


def _source(poll_interval: float = 60.0, api_key: str = "test-key") -> tuple[MassiveDataSource, PriceCache]:
    """A source with a stub client so _poll_once runs, plus its cache."""
    cache = PriceCache()
    source = MassiveDataSource(api_key=api_key, price_cache=cache, poll_interval=poll_interval)
    source._client = MagicMock()  # Satisfy the _poll_once guard
    return source, cache


class TestParseSnapshot:
    """parse_snapshot is a pure function over the real TickerSnapshot model."""

    def test_design_example(self):
        parsed = massive_client.parse_snapshot(_snap())

        assert parsed == massive_client.ParsedSnapshot("AAPL", 191.24, pytest.approx(1791100800.12), 190.0)

    def test_falls_back_to_minute_close_with_updated_timestamp(self):
        parsed = massive_client.parse_snapshot(_snap(lastTrade={}))

        assert parsed.price == 191.22
        assert parsed.timestamp == pytest.approx(1791100800.12)

    def test_falls_back_to_day_close_then_prev_day_close(self):
        assert massive_client.parse_snapshot(_snap(lastTrade={}, min={})).price == 191.2
        assert massive_client.parse_snapshot(_snap(lastTrade={}, min={}, day={})).price == 190.0

    def test_non_positive_trade_price_falls_through(self):
        assert massive_client.parse_snapshot(_snap(lastTrade={"p": 0, "t": 1791100800120000000})).price == 191.22
        assert massive_client.parse_snapshot(_snap(lastTrade={"p": -5})).price == 191.22

    def test_missing_prev_day_gives_no_reference_price(self):
        assert massive_client.parse_snapshot(_snap(prevDay={})).reference_price is None
        assert massive_client.parse_snapshot(_snap(prevDay={"c": 0})).reference_price is None

    def test_missing_ticker_returns_none(self):
        raw = {k: v for k, v in RAW_AAPL.items() if k != "ticker"}

        assert massive_client.parse_snapshot(TickerSnapshot.from_dict(raw)) is None

    def test_no_usable_price_returns_none(self):
        assert massive_client.parse_snapshot(_snap(lastTrade={}, min={}, day={}, prevDay={})) is None

    def test_sip_timestamp_is_nanoseconds(self):
        parsed = massive_client.parse_snapshot(_snap(lastTrade={"p": 191.24, "t": 1700000000500000000}))

        assert parsed.timestamp == pytest.approx(1700000000.5)

    def test_no_timestamps_uses_current_time(self):
        raw = {k: v for k, v in RAW_AAPL.items() if k != "updated"}
        raw["lastTrade"] = {"p": 191.24}

        parsed = massive_client.parse_snapshot(TickerSnapshot.from_dict(raw))

        assert abs(parsed.timestamp - time.time()) < 1.0


@pytest.mark.asyncio
class TestPollOnce:
    """_poll_once writes parsed snapshots to the cache and fails soft."""

    async def test_poll_writes_price_and_previous_close_baseline(self):
        source, cache = _source()
        source._tickers = ["AAPL", "GOOGL"]
        snapshots = [_snap(), _snap(ticker="GOOGL", lastTrade={"p": 175.25})]

        with patch.object(source, "_fetch_snapshots", return_value=snapshots):
            await source._poll_once()

        aapl = cache.get("AAPL")
        assert aapl.price == 191.24
        assert aapl.reference_price == 190.0
        assert aapl.day_change_percent == 0.65
        assert cache.get_price("GOOGL") == 175.25

    async def test_timestamp_is_converted_from_nanoseconds(self):
        source, cache = _source()
        source._tickers = ["AAPL"]

        with patch.object(source, "_fetch_snapshots", return_value=[_snap()]):
            await source._poll_once()

        assert cache.get("AAPL").timestamp == pytest.approx(1791100800.12)

    async def test_unparseable_snapshots_are_skipped(self):
        source, cache = _source()
        source._tickers = ["AAPL", "BAD", "WORSE"]
        no_price = _snap(ticker="BAD", lastTrade={}, min={}, day={}, prevDay={})

        with patch.object(source, "_fetch_snapshots", return_value=[no_price, None, _snap()]):
            await source._poll_once()

        assert cache.get_price("AAPL") == 191.24
        assert cache.get_price("BAD") is None

    async def test_returns_true_on_success_and_false_on_failure(self):
        source, _ = _source()
        source._tickers = ["AAPL"]

        with patch.object(source, "_fetch_snapshots", return_value=[_snap()]):
            assert await source._poll_once() is True
        with patch.object(source, "_fetch_snapshots", side_effect=Exception("network error")):
            assert await source._poll_once() is False

    async def test_api_error_does_not_crash_or_touch_the_cache(self):
        source, cache = _source()
        source._tickers = ["AAPL"]

        with patch.object(source, "_fetch_snapshots", side_effect=Exception("network error")):
            await source._poll_once()  # Should not raise

        assert cache.get_price("AAPL") is None

    async def test_empty_tickers_skips_poll(self):
        source, _ = _source()
        source._tickers = []

        with patch.object(source, "_fetch_snapshots") as mock_fetch:
            await source._poll_once()
            mock_fetch.assert_not_called()

    async def test_ticker_removed_while_fetch_in_flight_is_not_written_back(self):
        source, cache = _source()
        source._tickers = ["AAPL", "PYPL"]

        def fetch():
            # Simulates DELETE /api/watchlist/PYPL landing while the HTTP call runs.
            source._tickers = ["AAPL"]
            return [_snap(), _snap(ticker="PYPL", lastTrade={"p": 71.3})]

        with patch.object(source, "_fetch_snapshots", side_effect=fetch):
            await source._poll_once()

        assert "AAPL" in cache
        assert "PYPL" not in cache


@pytest.mark.asyncio
class TestFailureHandling:
    """Failures never leak the key, never flood the log and back off."""

    async def test_error_log_never_contains_the_api_key(self, caplog):
        source, _ = _source(api_key="test-secret-key")
        source._tickers = ["AAPL"]
        caplog.set_level(logging.DEBUG)

        with patch.object(
            source, "_fetch_snapshots", side_effect=Exception("401 for key test-secret-key")
        ):
            await source._poll_once()

        assert "test-secret-key" not in caplog.text
        assert "***" in caplog.text
        assert "Exception" in caplog.text

    async def test_one_error_log_per_failure_streak(self, caplog):
        source, _ = _source()
        source._tickers = ["AAPL"]
        caplog.set_level(logging.DEBUG, logger="app.market.massive_client")

        def error_count() -> int:
            return sum(1 for r in caplog.records if r.levelno >= logging.ERROR)

        with patch.object(source, "_fetch_snapshots", side_effect=Exception("boom")):
            await source._poll_once()
            assert error_count() == 1
            await source._poll_once()
            assert error_count() == 1  # Second failure of the streak is below error level

        with patch.object(source, "_fetch_snapshots", return_value=[_snap()]):
            await source._poll_once()
        assert "recovered after 2 failures" in caplog.text

        with patch.object(source, "_fetch_snapshots", side_effect=Exception("boom")):
            await source._poll_once()
        assert error_count() == 2  # A new streak logs at error again

    async def test_next_delay_doubles_per_failure_and_caps_at_120_seconds(self):
        source, _ = _source(poll_interval=15.0)
        delays = []
        for failures in range(6):
            source._consecutive_failures = failures
            delays.append(source._next_delay())

        assert delays == [15.0, 30.0, 60.0, 120.0, 120.0, 120.0]

    async def test_poll_loop_sleeps_with_backoff_and_resets_after_success(self, monkeypatch):
        source, _ = _source(poll_interval=15.0)
        source._tickers = ["AAPL"]
        real_sleep = asyncio.sleep
        sleeps: list[float] = []
        results = [Exception("429")] * 3 + [[_snap()]]

        async def fake_sleep(delay: float) -> None:
            sleeps.append(delay)
            if len(sleeps) >= 6:
                raise asyncio.CancelledError
            await real_sleep(0)

        def fetch():
            result = results.pop(0) if results else [_snap()]
            if isinstance(result, Exception):
                raise result
            return result

        monkeypatch.setattr(massive_client.asyncio, "sleep", fake_sleep)
        with patch.object(source, "_fetch_snapshots", side_effect=fetch):
            with pytest.raises(asyncio.CancelledError):
                await source._poll_loop()

        assert sleeps == [15.0, 30.0, 60.0, 120.0, 15.0, 15.0]

    async def test_start_does_not_raise_when_the_first_poll_fails(self):
        cache = PriceCache()
        source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=60.0)

        with patch("app.market.massive_client.RESTClient"):
            with patch.object(source, "_fetch_snapshots", side_effect=Exception("401")):
                await source.start(["AAPL"])  # Should not raise

        assert cache.get_price("AAPL") is None  # Never fabricated
        await source.stop()


@pytest.mark.asyncio
class TestTickerManagement:
    """add/remove/get behave as before."""

    async def test_add_ticker(self):
        source, _ = _source()

        await source.add_ticker("AAPL")
        assert "AAPL" in source.get_tickers()

    async def test_add_ticker_uppercase_normalization(self):
        source, _ = _source()

        await source.add_ticker("aapl")
        assert "AAPL" in source.get_tickers()

    async def test_add_ticker_strips_whitespace(self):
        source, _ = _source()

        await source.add_ticker("  AAPL  ")
        assert "AAPL" in source.get_tickers()

    async def test_remove_ticker(self):
        source, cache = _source()
        source._tickers = ["AAPL", "GOOGL"]
        cache.update("AAPL", 190.00)

        await source.remove_ticker("AAPL")
        assert "AAPL" not in source.get_tickers()
        assert cache.get("AAPL") is None

    async def test_get_tickers(self):
        source, _ = _source()
        source._tickers = ["AAPL", "GOOGL"]

        assert source.get_tickers() == ["AAPL", "GOOGL"]


@pytest.mark.asyncio
class TestLifecycle:
    """start/stop keep their contracts."""

    async def test_stop_is_idempotent(self):
        source, _ = _source()

        await source.stop()
        await source.stop()  # Should not raise

    async def test_stop_cancels_task(self):
        cache = PriceCache()
        source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=10.0)

        with patch("app.market.massive_client.RESTClient"):
            with patch.object(source, "_fetch_snapshots", return_value=[]):
                await source.start(["AAPL"])

        assert source._task is not None
        assert not source._task.done()

        await source.stop()
        assert source._task is None

    async def test_start_immediate_poll(self):
        cache = PriceCache()
        source = MassiveDataSource(api_key="test-key", price_cache=cache, poll_interval=60.0)

        with patch("app.market.massive_client.RESTClient"):
            with patch.object(source, "_fetch_snapshots", return_value=[_snap()]):
                await source.start(["AAPL"])

        # Cache should have data immediately from the first poll
        assert cache.get_price("AAPL") == 191.24

        await source.stop()
