"""Fixtures for service tests: a fresh temp database, a controlled cache and a fake source."""

from __future__ import annotations

import pytest

from app import db
from app.market import PriceCache
from app.services import watchlist as watchlist_service

from .fakes import FakeSource


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    monkeypatch.setenv("DB_PATH", str(path))
    db.init_db()
    watchlist_service.reset_baselines()
    yield path
    watchlist_service.reset_baselines()


@pytest.fixture
def cache() -> PriceCache:
    return PriceCache()


@pytest.fixture
async def source(cache) -> FakeSource:
    src = FakeSource(cache)
    with db.connect() as conn:
        await src.start(db.get_watchlist_tickers(conn))
    return src
