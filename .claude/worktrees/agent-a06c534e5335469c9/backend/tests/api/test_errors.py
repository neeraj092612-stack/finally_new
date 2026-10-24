"""The PLAN section 8 error envelope, API precedence over the static mount, watchlist edges."""

from __future__ import annotations

import sqlite3
from contextlib import closing
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from pydantic import BaseModel

from app.config import Settings
from app.main import create_app

INDEX_HTML = "<!doctype html><html><body>FinAlly static export</body></html>"


class _Body(BaseModel):
    quantity: int


def _settings(tmp_path: Path, *, static: bool = True) -> Settings:
    static_dir = tmp_path / "out"
    if static:
        static_dir.mkdir()
        (static_dir / "index.html").write_text(INDEX_HTML, encoding="utf-8")
    return Settings(db_path=tmp_path / "finally.db", static_dir=static_dir)


def _prepend_route(app: FastAPI, path: str, endpoint, methods: list[str]) -> None:
    """Register a test-only route ahead of the /api catch-all and the static mount."""
    app.add_api_route(path, endpoint, methods=methods)
    app.router.routes.insert(0, app.router.routes.pop())


@pytest.fixture
def client(tmp_path: Path):
    with TestClient(create_app(_settings(tmp_path))) as test_client:
        yield test_client


class TestUnknownApiPaths:
    def test_unknown_api_path_returns_json_404_envelope(self, client: TestClient) -> None:
        response = client.get("/api/nope")

        assert response.status_code == 404
        assert response.headers["content-type"].startswith("application/json")
        error = response.json()["error"]
        assert error["code"] == "not_found"
        assert error["message"]

    @pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE"])
    def test_unknown_api_path_is_json_for_every_method(
        self, client: TestClient, method: str
    ) -> None:
        response = client.request(method, "/api/does/not/exist")

        assert response.status_code == 404
        assert response.json()["error"]["code"] == "not_found"

    def test_api_health_stays_json_and_root_stays_html_with_static_mount(
        self, client: TestClient
    ) -> None:
        health = client.get("/api/health")
        root = client.get("/")

        assert health.headers["content-type"].startswith("application/json")
        assert health.json() == {"status": "ok"}
        assert root.headers["content-type"].startswith("text/html")
        assert "FinAlly static export" in root.text

    def test_missing_static_directory_still_serves_the_api(self, tmp_path: Path) -> None:
        settings = _settings(tmp_path, static=False)

        with TestClient(create_app(settings)) as test_client:
            response = test_client.get("/api/health")

        assert response.status_code == 200
        assert response.json() == {"status": "ok"}


class TestErrorEnvelope:
    def test_validation_failure_is_422_invalid_request(self, tmp_path: Path) -> None:
        app = create_app(_settings(tmp_path))

        def echo(body: _Body) -> dict[str, int]:
            return {"quantity": body.quantity}

        _prepend_route(app, "/api/_test/echo", echo, ["POST"])

        with TestClient(app) as test_client:
            response = test_client.post("/api/_test/echo", json={"quantity": "lots"})

        assert response.status_code == 422
        error = response.json()["error"]
        assert error["code"] == "invalid_request"
        assert "quantity" in error["message"]

    def test_validation_failure_does_not_leak_default_detail_shape(self, tmp_path: Path) -> None:
        app = create_app(_settings(tmp_path))

        def echo(body: _Body) -> dict[str, int]:
            return {"quantity": body.quantity}

        _prepend_route(app, "/api/_test/echo", echo, ["POST"])

        with TestClient(app) as test_client:
            response = test_client.post("/api/_test/echo", json={})

        assert "detail" not in response.json()
        assert response.json()["error"]["code"] == "invalid_request"

    def test_api_error_renders_its_own_code_status_and_message(self, tmp_path: Path) -> None:
        from app.errors import ApiError

        app = create_app(_settings(tmp_path))

        def boom() -> None:
            raise ApiError("insufficient_cash", 400, "Need more cash.")

        _prepend_route(app, "/api/_test/boom", boom, ["GET"])

        with TestClient(app) as test_client:
            response = test_client.get("/api/_test/boom")

        assert response.status_code == 400
        assert response.json() == {
            "error": {"code": "insufficient_cash", "message": "Need more cash."}
        }

    def test_unexpected_http_status_maps_to_http_error_code(self, tmp_path: Path) -> None:
        from fastapi import HTTPException

        app = create_app(_settings(tmp_path))

        def teapot() -> None:
            raise HTTPException(status_code=418, detail="short and stout")

        _prepend_route(app, "/api/_test/teapot", teapot, ["GET"])

        with TestClient(app) as test_client:
            response = test_client.get("/api/_test/teapot")

        assert response.status_code == 418
        assert response.json() == {"error": {"code": "http_error", "message": "short and stout"}}

    def test_method_not_allowed_uses_the_envelope(self, client: TestClient) -> None:
        response = client.post("/api/health")

        assert response.status_code == 405
        assert response.json()["error"]["code"] == "http_error"


class TestWatchlistEdges:
    def test_empty_watchlist_returns_empty_list(self, tmp_path: Path) -> None:
        settings = _settings(tmp_path)
        with TestClient(create_app(settings)):
            pass  # first lifespan creates and seeds the database
        with closing(sqlite3.connect(settings.db_path)) as conn, conn:
            conn.execute("DELETE FROM watchlist")

        with TestClient(create_app(settings)) as test_client:
            response = test_client.get("/api/watchlist")

        assert response.status_code == 200
        assert response.json() == {"watchlist": []}

    def test_unpriced_ticker_has_null_price_fields(self, tmp_path: Path) -> None:
        settings = _settings(tmp_path)
        with TestClient(create_app(settings)):
            pass
        with closing(sqlite3.connect(settings.db_path)) as conn, conn:
            conn.execute("DELETE FROM watchlist")
            conn.execute(
                "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
                ("zzzz-id", "default", "ZZZZ", "2026-10-04T14:00:00Z"),
            )
        app = create_app(settings)
        # Start-up prices the watchlist; drop ZZZZ from the cache to model a source that never priced it.
        with TestClient(app) as test_client:
            app.state.price_cache.remove("ZZZZ")
            response = test_client.get("/api/watchlist")

        (entry,) = response.json()["watchlist"]
        assert entry["ticker"] == "ZZZZ"
        assert entry["price"] is None
        assert entry["previous_price"] is None
        assert entry["direction"] is None
        assert entry["day_change_percent"] is None
