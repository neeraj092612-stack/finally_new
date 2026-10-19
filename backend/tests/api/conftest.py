"""Fixtures for API tests: the real app with a temp DB, a controlled cache and a fake source."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.market import PriceCache
from app.services import watchlist as watchlist_service
from tests.services.fakes import FakeSource


@pytest.fixture
def env(tmp_path, monkeypatch):
    monkeypatch.setenv("DB_PATH", str(tmp_path / "test.db"))
    monkeypatch.setenv("STATIC_DIR", str(tmp_path / "no-static"))
    monkeypatch.setenv("LLM_MOCK", "true")
    monkeypatch.setenv("MASSIVE_API_KEY", "")
    yield tmp_path
    watchlist_service.reset_baselines()


@pytest.fixture
def cache() -> PriceCache:
    return PriceCache()


@pytest.fixture
def source(cache) -> FakeSource:
    return FakeSource(cache)


@pytest.fixture
def client(env, cache, source):
    with TestClient(create_app(price_cache=cache, market_source=source)) as c:
        yield c


def assert_error(response, status: int, code: str) -> dict:
    assert response.status_code == status, response.text
    body = response.json()
    assert set(body) == {"error"}
    assert body["error"]["code"] == code
    assert isinstance(body["error"]["message"], str) and body["error"]["message"]
    return body["error"]
