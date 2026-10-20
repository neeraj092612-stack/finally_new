"""End-to-end smoke test: a real uvicorn process seeds SQLite, streams prices and serves static."""

from __future__ import annotations

import json
import os
import socket
import sqlite3
import subprocess
import sys
import time
import urllib.request
from collections.abc import Iterator
from contextlib import closing
from pathlib import Path

import pytest

from app.config import Settings
from app.db.schema import DEFAULT_TICKERS
from app.main import create_app

BACKEND_DIR = Path(__file__).resolve().parents[1]
SSE_KEYS = {"ticker", "price", "previous_price", "timestamp", "change", "change_percent", "direction"}


class ServerHandle:
    """A uvicorn child process bound to a free local port."""

    def __init__(self, proc: subprocess.Popen, port: int, log_path: Path) -> None:
        self.proc = proc
        self.port = port
        self.log_path = log_path

    @property
    def base_url(self) -> str:
        return f"http://127.0.0.1:{self.port}"


def _free_port() -> int:
    with closing(socket.socket(socket.AF_INET, socket.SOCK_STREAM)) as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def start_server(db_path: Path, static_dir: Path, log_path: Path) -> ServerHandle:
    """Launch `uvicorn app.main:create_app --factory` and wait until /api/health answers."""
    port = _free_port()
    env = os.environ.copy()
    env["DB_PATH"] = str(db_path)
    env["STATIC_DIR"] = str(static_dir)
    env.pop("MASSIVE_API_KEY", None)  # always use the simulator in tests
    log_file = log_path.open("wb")
    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:create_app",
            "--factory",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
        ],
        cwd=BACKEND_DIR,
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
    )
    handle = ServerHandle(proc, port, log_path)
    deadline = time.monotonic() + 20
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            break
        try:
            with urllib.request.urlopen(f"{handle.base_url}/api/health", timeout=1):
                return handle
        except OSError:
            time.sleep(0.2)
    stop_server(handle)
    raise RuntimeError(f"server did not start:\n{log_path.read_text(errors='replace')}")


def stop_server(handle: ServerHandle) -> None:
    """Terminate only the process this test started."""
    if handle.proc.poll() is None:
        handle.proc.terminate()
        try:
            handle.proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            handle.proc.kill()
            handle.proc.wait(timeout=10)


@pytest.fixture(scope="module")
def smoke_dir(tmp_path_factory: pytest.TempPathFactory) -> Path:
    """Scratch directory holding the DB, the fake static export and server logs."""
    root = tmp_path_factory.mktemp("smoke")
    static = root / "static"
    static.mkdir()
    (static / "index.html").write_text("<html><body>FinAlly</body></html>", encoding="utf-8")
    return root


@pytest.fixture(scope="module")
def server(smoke_dir: Path) -> Iterator[ServerHandle]:
    handle = start_server(smoke_dir / "finally.db", smoke_dir / "static", smoke_dir / "server.log")
    yield handle
    stop_server(handle)


def _read_first_data_event(base_url: str, timeout: float = 5.0) -> tuple[str, dict]:
    """Return the first SSE line and the first parsed data payload from the price stream."""
    deadline = time.monotonic() + timeout
    with urllib.request.urlopen(f"{base_url}/api/stream/prices", timeout=timeout) as resp:
        first_line = resp.readline().decode().strip()
        while time.monotonic() < deadline:
            line = resp.readline().decode().strip()
            if line.startswith("data:"):
                return first_line, json.loads(line[len("data:"):])
    raise AssertionError("no SSE data event within timeout")


def test_root_serves_static_index(server: ServerHandle) -> None:
    with urllib.request.urlopen(f"{server.base_url}/", timeout=5) as resp:
        assert resp.status == 200
        assert resp.headers["content-type"].startswith("text/html")
        assert "FinAlly" in resp.read().decode()


def test_sse_streams_every_seeded_ticker(server: ServerHandle) -> None:
    first_line, payload = _read_first_data_event(server.base_url)
    assert first_line == "retry: 1000"
    assert set(payload) == set(DEFAULT_TICKERS)
    for ticker in DEFAULT_TICKERS:
        update = payload[ticker]
        assert set(update) == SSE_KEYS
        assert update["ticker"] == ticker
        assert isinstance(update["price"], float)


def test_health_returns_ok_json(server: ServerHandle) -> None:
    with urllib.request.urlopen(f"{server.base_url}/api/health", timeout=5) as resp:
        assert resp.status == 200
        assert resp.headers["content-type"].startswith("application/json")
        assert json.loads(resp.read()) == {"status": "ok"}


def test_health_answers_while_sse_client_is_connected(server: ServerHandle) -> None:
    with urllib.request.urlopen(f"{server.base_url}/api/stream/prices", timeout=5) as sse:
        assert sse.readline().decode().strip() == "retry: 1000"
        started = time.monotonic()
        with urllib.request.urlopen(f"{server.base_url}/api/health", timeout=2) as resp:
            assert resp.status == 200
            assert json.loads(resp.read()) == {"status": "ok"}
        assert time.monotonic() - started < 2.0


def test_api_routes_win_over_static_mount(server: ServerHandle) -> None:
    with urllib.request.urlopen(f"{server.base_url}/api/health", timeout=5) as api:
        assert api.headers["content-type"].startswith("application/json")
    with urllib.request.urlopen(f"{server.base_url}/", timeout=5) as page:
        assert page.headers["content-type"].startswith("text/html")


def test_database_is_created_and_seeded(server: ServerHandle, smoke_dir: Path) -> None:
    db_path = smoke_dir / "finally.db"
    assert db_path.exists()
    with closing(sqlite3.connect(db_path)) as conn:
        tickers = [
            row[0] for row in conn.execute("SELECT ticker FROM watchlist ORDER BY added_at, rowid")
        ]
        profiles = conn.execute("SELECT id, cash_balance FROM users_profile").fetchall()
    assert tickers == list(DEFAULT_TICKERS)
    assert profiles == [("default", 10000.0)]


def test_restart_on_same_db_does_not_reseed(smoke_dir: Path, tmp_path: Path) -> None:
    db_path = tmp_path / "restart.db"
    static_dir = smoke_dir / "static"
    first = start_server(db_path, static_dir, tmp_path / "first.log")
    stop_server(first)
    second = start_server(db_path, static_dir, tmp_path / "second.log")
    try:
        with closing(sqlite3.connect(db_path)) as conn:
            watch_count = conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0]
            profiles = conn.execute("SELECT id, cash_balance FROM users_profile").fetchall()
        assert watch_count == 10
        assert profiles == [("default", 10000.0)]
    finally:
        stop_server(second)


@pytest.mark.parametrize("missing", [False, True])
def test_create_app_tolerates_missing_static_dir(tmp_path: Path, missing: bool) -> None:
    static_dir = tmp_path / "missing" if missing else None
    app = create_app(Settings(db_path=tmp_path / "t.db", static_dir=static_dir))
    assert app is not None
