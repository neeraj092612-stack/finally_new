"""Tests for the repository functions in app.db."""

import sqlite3
import uuid

import pytest

from app import db


def _is_uuid(value: str) -> bool:
    return str(uuid.UUID(value)) == value


# --- Cash ---


def test_get_and_set_cash_balance(conn):
    assert db.get_cash_balance(conn) == 10000.0
    db.set_cash_balance(conn, 8087.6)
    assert db.get_cash_balance(conn) == 8087.6
    assert isinstance(db.get_cash_balance(conn), float)


def test_cash_balance_missing_profile_raises(conn):
    conn.execute("DELETE FROM users_profile")
    with pytest.raises(LookupError):
        db.get_cash_balance(conn)
    with pytest.raises(LookupError):
        db.set_cash_balance(conn, 5.0)


# --- Watchlist ---


def test_list_watchlist_shape_and_order(conn):
    entries = db.list_watchlist(conn)
    assert [e["ticker"] for e in entries] == db.DEFAULT_TICKERS
    assert set(entries[0]) == {"ticker", "added_at"}


def test_add_watchlist_ticker_appends(conn):
    entry, created = db.add_watchlist_ticker(conn, "PYPL")
    assert created is True
    assert entry["ticker"] == "PYPL"
    assert entry["added_at"].endswith("Z")
    assert db.get_watchlist_tickers(conn)[-1] == "PYPL"


def test_add_watchlist_ticker_is_idempotent(conn):
    first, created1 = db.add_watchlist_ticker(conn, "PYPL")
    second, created2 = db.add_watchlist_ticker(conn, "PYPL")
    assert (created1, created2) == (True, False)
    assert first == second
    assert db.get_watchlist_tickers(conn).count("PYPL") == 1


def test_add_existing_default_ticker_not_created(conn):
    _, created = db.add_watchlist_ticker(conn, "AAPL")
    assert created is False
    assert len(db.list_watchlist(conn)) == 10


def test_watchlist_unique_constraint(conn):
    with pytest.raises(sqlite3.IntegrityError):
        conn.execute(
            "INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?, 'default', 'AAPL', 'x')",
            (str(uuid.uuid4()),),
        )


def test_watchlist_ids_are_uuids(conn):
    ids = [row["id"] for row in conn.execute("SELECT id FROM watchlist")]
    assert all(_is_uuid(i) for i in ids)


def test_is_watched(conn):
    assert db.is_watched(conn, "AAPL")
    assert not db.is_watched(conn, "PYPL")


def test_remove_watchlist_ticker(conn):
    assert db.remove_watchlist_ticker(conn, "AAPL") is True
    assert not db.is_watched(conn, "AAPL")
    assert db.remove_watchlist_ticker(conn, "AAPL") is False
    assert db.remove_watchlist_ticker(conn, "ZZZZ") is False


def test_readd_after_remove_goes_to_end(conn):
    db.remove_watchlist_ticker(conn, "AAPL")
    _, created = db.add_watchlist_ticker(conn, "AAPL")
    assert created is True
    assert db.get_watchlist_tickers(conn)[-1] == "AAPL"


# --- Positions ---


def test_positions_empty_initially(conn):
    assert db.list_positions(conn) == []
    assert db.get_position(conn, "AAPL") is None


def test_upsert_position_insert_and_update(conn):
    db.upsert_position(conn, "AAPL", 10, 191.24)
    pos = db.get_position(conn, "AAPL")
    assert pos["ticker"] == "AAPL"
    assert pos["quantity"] == 10
    assert pos["avg_cost"] == 191.24
    assert set(pos) == {"ticker", "quantity", "avg_cost", "updated_at"}

    db.upsert_position(conn, "AAPL", 15, 192.0)
    pos = db.get_position(conn, "AAPL")
    assert (pos["quantity"], pos["avg_cost"]) == (15, 192.0)
    assert conn.execute("SELECT COUNT(*) FROM positions").fetchone()[0] == 1


def test_upsert_position_keeps_id(conn):
    db.upsert_position(conn, "AAPL", 1, 1.0)
    id1 = conn.execute("SELECT id FROM positions").fetchone()[0]
    db.upsert_position(conn, "AAPL", 2, 2.0)
    id2 = conn.execute("SELECT id FROM positions").fetchone()[0]
    assert id1 == id2 and _is_uuid(id1)


def test_list_positions_ordered_by_ticker(conn):
    for ticker in ["TSLA", "AAPL", "MSFT"]:
        db.upsert_position(conn, ticker, 1, 100.0)
    assert [p["ticker"] for p in db.list_positions(conn)] == ["AAPL", "MSFT", "TSLA"]


def test_delete_position(conn):
    db.upsert_position(conn, "AAPL", 1, 100.0)
    db.delete_position(conn, "AAPL")
    assert db.get_position(conn, "AAPL") is None
    db.delete_position(conn, "AAPL")  # no error when absent


# --- Trades ---


def test_insert_and_list_trades(conn):
    t1 = db.insert_trade(conn, "AAPL", "buy", 10, 191.24)
    t2 = db.insert_trade(conn, "AAPL", "sell", 4, 195.0)
    assert set(t1) == {"id", "ticker", "side", "quantity", "price", "executed_at"}
    assert _is_uuid(t1["id"])
    assert t1["executed_at"].endswith("Z")
    assert db.list_trades(conn) == [t1, t2]


def test_trade_side_check_constraint(conn):
    with pytest.raises(sqlite3.IntegrityError):
        db.insert_trade(conn, "AAPL", "short", 1, 1.0)


# --- Snapshots ---


def test_insert_and_list_snapshots(conn):
    assert db.list_snapshots(conn) == []
    s1 = db.insert_snapshot(conn, 10000.0)
    s2 = db.insert_snapshot(conn, 10050.5)
    assert set(s1) == {"total_value", "recorded_at"}
    assert db.list_snapshots(conn) == [s1, s2]


# --- Chat ---


def test_insert_chat_message_user(conn):
    msg = db.insert_chat_message(conn, "user", "hello", None)
    assert set(msg) == {"id", "role", "content", "actions", "created_at"}
    assert _is_uuid(msg["id"])
    assert msg["actions"] is None
    assert db.list_chat_messages(conn) == [msg]


def test_chat_actions_json_round_trip(conn):
    actions = {
        "watchlist_changes": [{"ticker": "PYPL", "action": "add", "status": "executed", "error": None}],
        "trades": [
            {"ticker": "PYPL", "side": "buy", "quantity": 5, "status": "executed", "price": 71.3, "error": None},
            {
                "ticker": "TSLA",
                "side": "buy",
                "quantity": 500,
                "status": "failed",
                "price": None,
                "error": {"code": "insufficient_cash", "message": "Need more."},
            },
        ],
    }
    msg = db.insert_chat_message(conn, "assistant", "done", actions)
    stored = db.list_chat_messages(conn)[0]
    assert stored == msg
    assert stored["actions"] == actions
    raw = conn.execute("SELECT actions FROM chat_messages").fetchone()[0]
    assert isinstance(raw, str)


def test_chat_role_check_constraint(conn):
    with pytest.raises(sqlite3.IntegrityError):
        db.insert_chat_message(conn, "system", "x", None)


def test_list_chat_messages_limit_returns_most_recent_oldest_first(conn):
    for i in range(30):
        db.insert_chat_message(conn, "user" if i % 2 == 0 else "assistant", f"m{i}", None)
    all_msgs = db.list_chat_messages(conn)
    assert [m["content"] for m in all_msgs] == [f"m{i}" for i in range(30)]
    last = db.list_chat_messages(conn, limit=20)
    assert [m["content"] for m in last] == [f"m{i}" for i in range(10, 30)]
    assert db.list_chat_messages(conn, limit=0) == []
    assert len(db.list_chat_messages(conn, limit=100)) == 30


def test_list_chat_messages_orders_by_created_at(conn):
    conn.execute(
        "INSERT INTO chat_messages (id, role, content, actions, created_at) VALUES (?, 'user', 'later', NULL, '2030-01-01T00:00:00Z')",
        (str(uuid.uuid4()),),
    )
    conn.execute(
        "INSERT INTO chat_messages (id, role, content, actions, created_at) VALUES (?, 'user', 'earlier', NULL, '2020-01-01T00:00:00Z')",
        (str(uuid.uuid4()),),
    )
    assert [m["content"] for m in db.list_chat_messages(conn)] == ["earlier", "later"]
    assert [m["content"] for m in db.list_chat_messages(conn, limit=1)] == ["later"]
