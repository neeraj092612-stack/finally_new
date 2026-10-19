"""Tests for schema creation, seeding, paths and transaction handling."""

import re
import sqlite3

import pytest

from app import db
from app.db import connection

EXPECTED_TABLES = {
    "users_profile",
    "watchlist",
    "positions",
    "trades",
    "portfolio_snapshots",
    "chat_messages",
}


def test_utc_now_iso_format():
    assert re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z", db.utc_now_iso())


def test_get_db_path_from_env(tmp_path, monkeypatch):
    target = tmp_path / "nested" / "dir" / "x.db"
    monkeypatch.setenv("DB_PATH", str(target))
    assert db.get_db_path() == target
    assert target.parent.is_dir()


def test_get_db_path_default(monkeypatch):
    monkeypatch.delenv("DB_PATH", raising=False)
    path = db.get_db_path()
    assert path.name == "finally.db"
    assert path.parent.name == "db"
    assert (path.parent.parent / "backend").is_dir()


def test_init_db_creates_all_tables(db_path):
    with db.connect(db_path) as conn:
        names = {
            row["name"]
            for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")
        }
    assert EXPECTED_TABLES <= names


def test_init_db_seeds_defaults(conn):
    assert db.get_cash_balance(conn) == db.STARTING_CASH
    assert db.get_watchlist_tickers(conn) == db.DEFAULT_TICKERS
    profile = conn.execute("SELECT * FROM users_profile").fetchall()
    assert len(profile) == 1
    assert profile[0]["id"] == db.DEFAULT_USER_ID


def test_init_db_is_idempotent(db_path):
    with db.connect(db_path) as conn:
        db.set_cash_balance(conn, 1234.5)
        db.remove_watchlist_ticker(conn, "AAPL")
    db.init_db(db_path)
    db.init_db(db_path)
    with db.connect(db_path) as conn:
        assert db.get_cash_balance(conn) == 1234.5
        assert "AAPL" not in db.get_watchlist_tickers(conn)
        assert conn.execute("SELECT COUNT(*) FROM users_profile").fetchone()[0] == 1
        assert conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0] == 9


def test_init_db_uses_env_path_by_default(tmp_path, monkeypatch):
    target = tmp_path / "sub" / "env.db"
    monkeypatch.setenv("DB_PATH", str(target))
    db.init_db()
    assert target.exists()
    with db.connect() as conn:
        assert db.get_cash_balance(conn) == db.STARTING_CASH


def test_init_db_creates_missing_tables_in_existing_file(tmp_path):
    path = tmp_path / "partial.db"
    raw = sqlite3.connect(path)
    raw.execute("CREATE TABLE unrelated (x INTEGER)")
    raw.commit()
    raw.close()
    db.init_db(path)
    with db.connect(path) as conn:
        assert db.get_watchlist_tickers(conn) == db.DEFAULT_TICKERS


def test_seed_user_id_defaults(conn):
    rows = conn.execute("SELECT DISTINCT user_id FROM watchlist").fetchall()
    assert [row["user_id"] for row in rows] == ["default"]


def test_connect_commits_on_success(db_path):
    with db.connect(db_path) as conn:
        db.set_cash_balance(conn, 42.0)
    with db.connect(db_path) as conn:
        assert db.get_cash_balance(conn) == 42.0


def test_connect_rolls_back_on_exception(db_path):
    with pytest.raises(RuntimeError):
        with db.connect(db_path) as conn:
            db.set_cash_balance(conn, 1.0)
            db.insert_trade(conn, "AAPL", "buy", 1, 100.0)
            db.upsert_position(conn, "AAPL", 1, 100.0)
            raise RuntimeError("boom")
    with db.connect(db_path) as conn:
        assert db.get_cash_balance(conn) == db.STARTING_CASH
        assert db.list_trades(conn) == []
        assert db.list_positions(conn) == []


def test_connect_row_factory_and_foreign_keys(conn):
    assert conn.row_factory is sqlite3.Row
    assert conn.execute("PRAGMA foreign_keys").fetchone()[0] == 1


def test_connect_closes_connection(db_path):
    with db.connect(db_path) as conn:
        pass
    with pytest.raises(sqlite3.ProgrammingError):
        conn.execute("SELECT 1")


def test_schema_sql_is_packaged():
    assert "CREATE TABLE IF NOT EXISTS chat_messages" in connection._schema_sql()
