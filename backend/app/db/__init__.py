"""Database layer for FinAlly (SQLite, stdlib sqlite3).

Usage:
    from app import db

    db.init_db()
    with db.connect() as conn:          # one block == one transaction
        cash = db.get_cash_balance(conn)
"""

from .connection import (
    DEFAULT_TICKERS,
    DEFAULT_USER_ID,
    STARTING_CASH,
    connect,
    get_db_path,
    init_db,
    utc_now_iso,
)
from .repository import (
    add_watchlist_ticker,
    delete_position,
    get_cash_balance,
    get_position,
    get_watchlist_tickers,
    insert_chat_message,
    insert_snapshot,
    insert_trade,
    is_watched,
    list_chat_messages,
    list_positions,
    list_snapshots,
    list_trades,
    list_watchlist,
    remove_watchlist_ticker,
    set_cash_balance,
    upsert_position,
)

__all__ = [
    "DEFAULT_TICKERS",
    "DEFAULT_USER_ID",
    "STARTING_CASH",
    "add_watchlist_ticker",
    "connect",
    "delete_position",
    "get_cash_balance",
    "get_db_path",
    "get_position",
    "get_watchlist_tickers",
    "init_db",
    "insert_chat_message",
    "insert_snapshot",
    "insert_trade",
    "is_watched",
    "list_chat_messages",
    "list_positions",
    "list_snapshots",
    "list_trades",
    "list_watchlist",
    "remove_watchlist_ticker",
    "set_cash_balance",
    "upsert_position",
    "utc_now_iso",
]
