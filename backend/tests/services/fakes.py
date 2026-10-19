"""Test doubles shared by the service and API tests."""

from __future__ import annotations

from app.market import MarketDataSource, PriceCache

DEFAULT_PRICES = {
    "AAPL": 100.0,
    "GOOGL": 150.0,
    "MSFT": 400.0,
    "AMZN": 180.0,
    "TSLA": 250.0,
    "NVDA": 120.0,
    "META": 500.0,
    "JPM": 200.0,
    "V": 280.0,
    "NFLX": 600.0,
    "PYPL": 70.0,
}


class FakeSource(MarketDataSource):
    """Seeds the cache from a fixed price table; tickers not in the table stay unpriced."""

    def __init__(self, cache: PriceCache, prices: dict[str, float] | None = None) -> None:
        self.cache = cache
        self.prices = dict(DEFAULT_PRICES if prices is None else prices)
        self.tickers: list[str] = []
        self.started = False
        self.stopped = False

    async def start(self, tickers: list[str]) -> None:
        self.started = True
        for ticker in tickers:
            await self.add_ticker(ticker)

    async def stop(self) -> None:
        self.stopped = True

    async def add_ticker(self, ticker: str) -> None:
        if ticker not in self.tickers:
            self.tickers.append(ticker)
        if ticker in self.prices:
            self.cache.update(ticker, self.prices[ticker])

    async def remove_ticker(self, ticker: str) -> None:
        self.tickers = [t for t in self.tickers if t != ticker]
        self.cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return list(self.tickers)
