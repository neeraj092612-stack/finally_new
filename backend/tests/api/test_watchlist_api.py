"""GET/POST /api/watchlist and DELETE /api/watchlist/{ticker}."""

from __future__ import annotations

from app import db

from .conftest import assert_error

ENTRY_KEYS = {"ticker", "price", "previous_price", "direction", "day_change_percent", "added_at"}


def test_get_default_watchlist(client):
    r = client.get("/api/watchlist")
    assert r.status_code == 200
    entries = r.json()["watchlist"]
    assert [e["ticker"] for e in entries] == db.DEFAULT_TICKERS
    for e in entries:
        assert set(e) == ENTRY_KEYS
        assert e["price"] is not None
        assert e["day_change_percent"] == 0.0


def test_day_change_percent_tracks_startup_baseline(client, cache):
    cache.update("AAPL", 100.65)
    aapl = client.get("/api/watchlist").json()["watchlist"][0]
    assert aapl["day_change_percent"] == 0.65
    assert aapl["direction"] == "up"
    assert aapl["previous_price"] == 100.0


def test_add_returns_201_then_200(client, source):
    r = client.post("/api/watchlist", json={"ticker": " pypl "})
    assert r.status_code == 201
    entry = r.json()
    assert set(entry) == ENTRY_KEYS
    assert entry["ticker"] == "PYPL"
    assert entry["price"] == 70.0
    assert "PYPL" in source.get_tickers()

    r = client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert r.status_code == 200
    assert r.json()["ticker"] == "PYPL"

    tickers = [e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]]
    assert tickers[-1] == "PYPL"
    assert tickers.count("PYPL") == 1


def test_add_unpriced_ticker_has_null_prices(client):
    entry = client.post("/api/watchlist", json={"ticker": "ZZZZ"}).json()
    assert entry["price"] is None
    assert entry["direction"] is None
    assert entry["day_change_percent"] is None


def test_add_errors(client):
    assert_error(client.post("/api/watchlist", json={"ticker": "bad ticker"}), 400, "invalid_ticker")
    assert_error(client.post("/api/watchlist", json={}), 422, "invalid_request")
    assert_error(client.post("/api/watchlist", json={"ticker": 5}), 422, "invalid_request")


def test_delete(client, source, cache):
    r = client.delete("/api/watchlist/nflx")
    assert r.status_code == 204
    assert r.content == b""
    assert "NFLX" not in source.get_tickers()
    assert cache.get("NFLX") is None
    tickers = [e["ticker"] for e in client.get("/api/watchlist").json()["watchlist"]]
    assert "NFLX" not in tickers


def test_delete_errors(client):
    assert_error(client.delete("/api/watchlist/PYPL"), 404, "not_watched")
    assert_error(client.delete("/api/watchlist/1BAD"), 400, "invalid_ticker")


def test_delete_with_open_position_is_409(client):
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "buy"})
    assert_error(client.delete("/api/watchlist/AAPL"), 409, "position_open")
    client.post("/api/portfolio/trade", json={"ticker": "AAPL", "quantity": 1, "side": "sell"})
    assert client.delete("/api/watchlist/AAPL").status_code == 204
