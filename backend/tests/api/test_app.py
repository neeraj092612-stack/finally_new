"""App wiring: health, lifespan, error shape, static mount, router registration."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app import db
from app.main import create_app
from tests.services.fakes import FakeSource

from .conftest import assert_error


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_lifespan_starts_and_stops_source(env, cache, source):
    with TestClient(create_app(price_cache=cache, market_source=source)) as c:
        assert source.started
        assert source.get_tickers() == db.DEFAULT_TICKERS
        assert c.app.state.price_cache is cache
        assert c.app.state.market_source is source
    assert source.stopped


def test_db_survives_restart(env, cache):
    with TestClient(create_app(price_cache=cache, market_source=FakeSource(cache))) as c:
        c.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "buy"})
    with TestClient(create_app(price_cache=cache, market_source=FakeSource(cache))) as c:
        assert c.get("/api/portfolio").json()["positions"][0]["quantity"] == 1
        # one startup snapshot per start plus one for the trade
        assert len(c.get("/api/portfolio/history").json()["snapshots"]) == 3


def test_unknown_api_route_uses_error_shape(client):
    assert_error(client.get("/api/does-not-exist"), 404, "not_found")
    assert_error(client.put("/api/health"), 405, "method_not_allowed")


def test_routes_registered(client):
    paths = {route.path for route in client.app.routes}
    assert {
        "/api/health",
        "/api/portfolio",
        "/api/portfolio/trade",
        "/api/portfolio/history",
        "/api/watchlist",
        "/api/watchlist/{ticker}",
        "/api/stream/prices",
        "/api/chat",
    } <= paths


def test_static_mount_serves_index_after_api(env, cache, source, monkeypatch):
    static = env / "static"
    static.mkdir()
    (static / "index.html").write_text("<html>FinAlly</html>", encoding="utf-8")
    monkeypatch.setenv("STATIC_DIR", str(static))
    with TestClient(create_app(price_cache=cache, market_source=source)) as c:
        r = c.get("/")
        assert r.status_code == 200
        assert "FinAlly" in r.text
        assert c.get("/api/health").json() == {"status": "ok"}
        assert c.get("/missing.js").status_code == 404


def test_chat_router_mounted(client):
    r = client.post("/api/chat", json={"message": ""})
    assert_error(r, 422, "invalid_request")
