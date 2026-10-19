"""Fixtures for the chat tests: a temp database, a primed price cache and a fake market source."""

from __future__ import annotations

import pytest

from app import db
from app.market import PriceCache

NEW_TICKER_PRICE = 50.0


class FakeSource:
    """Mimics the simulator: a newly added ticker is priced immediately."""

    def __init__(self, cache: PriceCache) -> None:
        self.cache = cache
        self.tickers: list[str] = list(db.DEFAULT_TICKERS)

    async def start(self, tickers: list[str]) -> None:  # pragma: no cover - unused
        self.tickers = list(tickers)

    async def stop(self) -> None:  # pragma: no cover - unused
        pass

    async def add_ticker(self, ticker: str) -> None:
        if ticker not in self.tickers:
            self.tickers.append(ticker)
            self.cache.update(ticker, NEW_TICKER_PRICE)

    async def remove_ticker(self, ticker: str) -> None:
        if ticker in self.tickers:
            self.tickers.remove(ticker)
        self.cache.remove(ticker)

    def get_tickers(self) -> list[str]:
        return list(self.tickers)


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.delenv("LLM_MOCK", raising=False)
    db.init_db()


@pytest.fixture
def cache() -> PriceCache:
    c = PriceCache()
    for ticker in db.DEFAULT_TICKERS:
        c.update(ticker, 100.0)
    return c


@pytest.fixture
def source(cache) -> FakeSource:
    return FakeSource(cache)


@pytest.fixture
def mock_mode(monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "true")


def stored_messages() -> list[dict]:
    with db.connect() as conn:
        return db.list_chat_messages(conn)
