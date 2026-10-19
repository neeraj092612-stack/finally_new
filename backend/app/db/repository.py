"""Repository functions. All take an open connection, return plain dicts, and use DEFAULT_USER_ID."""

from __future__ import annotations

import json
import sqlite3

from .connection import DEFAULT_USER_ID, new_id, utc_now_iso

# --- Cash ---------------------------------------------------------------------


def get_cash_balance(conn: sqlite3.Connection) -> float:
    row = conn.execute(
        "SELECT cash_balance FROM users_profile WHERE id = ?", (DEFAULT_USER_ID,)
    ).fetchone()
    if row is None:
        raise LookupError(f"user profile {DEFAULT_USER_ID!r} not found; was init_db() called?")
    return float(row["cash_balance"])


def set_cash_balance(conn: sqlite3.Connection, value: float) -> None:
    cur = conn.execute(
        "UPDATE users_profile SET cash_balance = ? WHERE id = ?", (float(value), DEFAULT_USER_ID)
    )
    if cur.rowcount == 0:
        raise LookupError(f"user profile {DEFAULT_USER_ID!r} not found; was init_db() called?")


# --- Watchlist ----------------------------------------------------------------


def list_watchlist(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        "SELECT ticker, added_at FROM watchlist WHERE user_id = ? ORDER BY added_at, rowid",
        (DEFAULT_USER_ID,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_watchlist_tickers(conn: sqlite3.Connection) -> list[str]:
    return [entry["ticker"] for entry in list_watchlist(conn)]


def _get_watchlist_entry(conn: sqlite3.Connection, ticker: str) -> dict | None:
    row = conn.execute(
        "SELECT ticker, added_at FROM watchlist WHERE user_id = ? AND ticker = ?",
        (DEFAULT_USER_ID, ticker),
    ).fetchone()
    return dict(row) if row else None


def is_watched(conn: sqlite3.Connection, ticker: str) -> bool:
    return _get_watchlist_entry(conn, ticker) is not None


def add_watchlist_ticker(conn: sqlite3.Connection, ticker: str) -> tuple[dict, bool]:
    """Add a ticker. Returns (entry, created); created is False if it was already present."""
    cur = conn.execute(
        "INSERT OR IGNORE INTO watchlist (id, user_id, ticker, added_at) VALUES (?, ?, ?, ?)",
        (new_id(), DEFAULT_USER_ID, ticker, utc_now_iso()),
    )
    entry = _get_watchlist_entry(conn, ticker)
    assert entry is not None
    return entry, cur.rowcount == 1


def remove_watchlist_ticker(conn: sqlite3.Connection, ticker: str) -> bool:
    cur = conn.execute(
        "DELETE FROM watchlist WHERE user_id = ? AND ticker = ?", (DEFAULT_USER_ID, ticker)
    )
    return cur.rowcount > 0


# --- Positions ----------------------------------------------------------------

_POSITION_COLUMNS = "ticker, quantity, avg_cost, updated_at"


def list_positions(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        f"SELECT {_POSITION_COLUMNS} FROM positions WHERE user_id = ? ORDER BY ticker",
        (DEFAULT_USER_ID,),
    ).fetchall()
    return [dict(row) for row in rows]


def get_position(conn: sqlite3.Connection, ticker: str) -> dict | None:
    row = conn.execute(
        f"SELECT {_POSITION_COLUMNS} FROM positions WHERE user_id = ? AND ticker = ?",
        (DEFAULT_USER_ID, ticker),
    ).fetchone()
    return dict(row) if row else None


def upsert_position(conn: sqlite3.Connection, ticker: str, quantity: int, avg_cost: float) -> None:
    conn.execute(
        """
        INSERT INTO positions (id, user_id, ticker, quantity, avg_cost, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT (user_id, ticker) DO UPDATE SET
            quantity = excluded.quantity,
            avg_cost = excluded.avg_cost,
            updated_at = excluded.updated_at
        """,
        (new_id(), DEFAULT_USER_ID, ticker, int(quantity), float(avg_cost), utc_now_iso()),
    )


def delete_position(conn: sqlite3.Connection, ticker: str) -> None:
    conn.execute("DELETE FROM positions WHERE user_id = ? AND ticker = ?", (DEFAULT_USER_ID, ticker))


# --- Trades -------------------------------------------------------------------


def insert_trade(
    conn: sqlite3.Connection, ticker: str, side: str, quantity: int, price: float
) -> dict:
    trade = {
        "id": new_id(),
        "ticker": ticker,
        "side": side,
        "quantity": int(quantity),
        "price": float(price),
        "executed_at": utc_now_iso(),
    }
    conn.execute(
        """
        INSERT INTO trades (id, user_id, ticker, side, quantity, price, executed_at)
        VALUES (:id, :user_id, :ticker, :side, :quantity, :price, :executed_at)
        """,
        {**trade, "user_id": DEFAULT_USER_ID},
    )
    return trade


def list_trades(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT id, ticker, side, quantity, price, executed_at FROM trades
        WHERE user_id = ? ORDER BY executed_at, rowid
        """,
        (DEFAULT_USER_ID,),
    ).fetchall()
    return [dict(row) for row in rows]


# --- Portfolio snapshots ------------------------------------------------------


def insert_snapshot(conn: sqlite3.Connection, total_value: float) -> dict:
    snapshot = {"total_value": float(total_value), "recorded_at": utc_now_iso()}
    conn.execute(
        """
        INSERT INTO portfolio_snapshots (id, user_id, total_value, recorded_at)
        VALUES (?, ?, ?, ?)
        """,
        (new_id(), DEFAULT_USER_ID, snapshot["total_value"], snapshot["recorded_at"]),
    )
    return snapshot


def list_snapshots(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute(
        """
        SELECT total_value, recorded_at FROM portfolio_snapshots
        WHERE user_id = ? ORDER BY recorded_at, rowid
        """,
        (DEFAULT_USER_ID,),
    ).fetchall()
    return [dict(row) for row in rows]


# --- Chat messages ------------------------------------------------------------


def _chat_row_to_dict(row: sqlite3.Row) -> dict:
    message = dict(row)
    message["actions"] = json.loads(message["actions"]) if message["actions"] is not None else None
    return message


def insert_chat_message(
    conn: sqlite3.Connection, role: str, content: str, actions: dict | None
) -> dict:
    message = {
        "id": new_id(),
        "role": role,
        "content": content,
        "actions": actions,
        "created_at": utc_now_iso(),
    }
    conn.execute(
        """
        INSERT INTO chat_messages (id, user_id, role, content, actions, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            message["id"],
            DEFAULT_USER_ID,
            role,
            content,
            json.dumps(actions) if actions is not None else None,
            message["created_at"],
        ),
    )
    return message


def list_chat_messages(conn: sqlite3.Connection, limit: int | None = None) -> list[dict]:
    """The most recent `limit` messages (all if None), returned oldest first."""
    sql = """
        SELECT id, role, content, actions, created_at FROM chat_messages
        WHERE user_id = ? ORDER BY created_at DESC, rowid DESC
    """
    params: tuple = (DEFAULT_USER_ID,)
    if limit is not None:
        sql += " LIMIT ?"
        params += (max(int(limit), 0),)
    rows = conn.execute(sql, params).fetchall()
    return [_chat_row_to_dict(row) for row in reversed(rows)]
