"""Massive (Polygon.io) API client for real market data."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from massive import RESTClient
from massive.rest.models import SnapshotMarketType, TickerSnapshot

from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)

NS_PER_SECOND = 1_000_000_000
MAX_BACKOFF_SECONDS = 120.0  # Keeps a failing key well inside the free tier's 5 calls/min
_MAX_BACKOFF_EXPONENT = 10  # Bounds 2**n so a long outage cannot overflow the float math


@dataclass(frozen=True, slots=True)
class ParsedSnapshot:
    """The fields the cache needs from one Massive ticker snapshot."""

    ticker: str
    price: float
    timestamp: float  # Unix seconds
    reference_price: float | None  # Previous close: the day-change baseline


def _positive(value: object) -> float | None:
    """Return value as a float when it is a positive number, else None."""
    if isinstance(value, (int, float)) and not isinstance(value, bool) and value > 0:
        return float(value)
    return None


def parse_snapshot(snap: TickerSnapshot) -> ParsedSnapshot | None:
    """Extract price, timestamp and day-change baseline from a Massive snapshot.

    Price is the first positive of last trade, latest minute bar, day close, previous
    close. Returns None when the snapshot has no ticker or no usable price.
    """
    if not snap.ticker:
        return None

    trade, minute, day, prev_day = snap.last_trade, snap.min, snap.day, snap.prev_day
    price = (
        _positive(trade.price if trade else None)
        or _positive(minute.close if minute else None)
        or _positive(day.close if day else None)
        or _positive(prev_day.close if prev_day else None)
    )
    if price is None:
        return None

    # Massive timestamps are Unix nanoseconds → convert to seconds
    ts_ns = (trade.sip_timestamp if trade else None) or snap.updated
    timestamp = ts_ns / NS_PER_SECOND if ts_ns else time.time()

    reference = _positive(prev_day.close if prev_day else None)
    return ParsedSnapshot(snap.ticker, price, timestamp, reference)


class MassiveDataSource(MarketDataSource):
    """MarketDataSource backed by the Massive (Polygon.io) REST API.

    Polls GET /v2/snapshot/locale/us/markets/stocks/tickers for all watched
    tickers in a single API call, then writes results to the PriceCache.

    Rate limits:
      - Free tier: 5 req/min → poll every 15s (default)
      - Paid tiers: higher limits → poll every 2-5s

    Failures never raise and never fabricate prices: the affected tickers simply stay
    unpriced until a poll succeeds.
    """

    def __init__(
        self,
        api_key: str,
        price_cache: PriceCache,
        poll_interval: float = 15.0,
    ) -> None:
        self._api_key = api_key
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None
        self._client: RESTClient | None = None
        self._consecutive_failures = 0

    async def start(self, tickers: list[str]) -> None:
        self._client = RESTClient(api_key=self._api_key)
        self._tickers = list(tickers)

        # Do an immediate first poll so the cache has data right away. A failure is
        # logged and swallowed, so startup never depends on the Massive API.
        await self._poll_once()

        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")
        logger.info(
            "Massive poller started: %d tickers, %.1fs interval",
            len(tickers),
            self._interval,
        )

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        self._client = None
        logger.info("Massive poller stopped")

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if ticker not in self._tickers:
            self._tickers.append(ticker)
            logger.info("Massive: added ticker %s (will appear on next poll)", ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        self._tickers = [t for t in self._tickers if t != ticker]
        self._cache.remove(ticker)
        logger.info("Massive: removed ticker %s", ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    # --- Internal ---

    def _next_delay(self) -> float:
        """Poll interval, doubled per consecutive failure, capped at MAX_BACKOFF_SECONDS."""
        exponent = min(self._consecutive_failures, _MAX_BACKOFF_EXPONENT)
        return min(self._interval * 2**exponent, MAX_BACKOFF_SECONDS)

    async def _poll_loop(self) -> None:
        """Poll on interval. First poll already happened in start()."""
        while True:
            await asyncio.sleep(self._next_delay())
            await self._poll_once()

    async def _poll_once(self) -> bool:
        """Execute one poll cycle: fetch snapshots, update cache. True unless the fetch failed."""
        if not self._tickers or not self._client:
            return True

        try:
            # The Massive RESTClient is synchronous — run in a thread to
            # avoid blocking the event loop.
            snapshots = await asyncio.to_thread(self._fetch_snapshots)
        except Exception as e:
            self._record_failure(e)
            return False

        if self._consecutive_failures:
            logger.info("Massive poll recovered after %d failures", self._consecutive_failures)
            self._consecutive_failures = 0

        # Re-read the watched set AFTER the await: a ticker removed while the request
        # was in flight must not be written back into the cache.
        active = set(self._tickers)
        processed = 0
        for snap in snapshots:
            try:
                parsed = parse_snapshot(snap)
                if parsed is None:
                    logger.warning("Skipping unusable snapshot for %s", getattr(snap, "ticker", "???"))
                    continue
                if parsed.ticker not in active:
                    continue
                self._cache.update(
                    ticker=parsed.ticker,
                    price=parsed.price,
                    timestamp=parsed.timestamp,
                    reference_price=parsed.reference_price,
                )
                processed += 1
            except (AttributeError, TypeError) as e:
                logger.warning(
                    "Skipping snapshot for %s: %s",
                    getattr(snap, "ticker", "???"),
                    e,
                )
        logger.debug("Massive poll: updated %d/%d tickers", processed, len(self._tickers))
        return True

    def _record_failure(self, error: Exception) -> None:
        """Log a failed poll without leaking the API key, once per failure streak."""
        self._consecutive_failures += 1
        message = str(error)
        if self._api_key:
            message = message.replace(self._api_key, "***")
        # Common failures: 401 (bad key), 429 (rate limit), network errors. Only the first
        # failure of a streak is an error; the backoff keeps the rest from flooding the log.
        level = logging.ERROR if self._consecutive_failures == 1 else logging.DEBUG
        logger.log(
            level,
            "Massive poll failed (%d in a row, next try in %.0fs): %s: %s",
            self._consecutive_failures,
            self._next_delay(),
            type(error).__name__,
            message,
        )

    def _fetch_snapshots(self) -> list:
        """Synchronous call to the Massive REST API. Runs in a thread."""
        return self._client.get_snapshot_all(
            market_type=SnapshotMarketType.STOCKS,
            tickers=list(self._tickers),
        )
