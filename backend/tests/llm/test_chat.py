"""Chat orchestration against a real temp database and the real services."""

import pytest

from app import db
from app.errors import AppError
from app.llm import chat
from app.llm.schema import ChatResponse, TradeRequest, WatchlistChange

from .conftest import NEW_TICKER_PRICE, stored_messages


def _reply(trades=(), changes=(), message="ok"):
    return ChatResponse(
        message=message,
        trades=[TradeRequest(ticker=t, side=s, quantity=q) for t, s, q in trades],
        watchlist_changes=[WatchlistChange(ticker=t, action=a) for t, a in changes],
    )


@pytest.fixture
def llm_reply(monkeypatch):
    """Set what the (non-mock) LLM returns; records the messages it was sent."""
    state = {"reply": _reply(), "sent": []}

    async def fake_call_llm(messages):
        state["sent"].append(messages)
        if isinstance(state["reply"], Exception):
            raise state["reply"]
        return state["reply"]

    monkeypatch.setattr(chat, "call_llm", fake_call_llm)
    return state


def _position(ticker):
    with db.connect() as conn:
        return db.get_position(conn, ticker)


def _watched(ticker):
    with db.connect() as conn:
        return db.is_watched(conn, ticker)


async def test_add_then_buy_new_ticker(cache, source, llm_reply):
    # Trade listed before the add in the LLM output still works: adds run first.
    llm_reply["reply"] = _reply(trades=[("PYPL", "buy", 5)], changes=[("pypl", "add")])
    result = await chat.handle_chat("buy pypl", cache, source)

    actions = result["message"]["actions"]
    assert actions["watchlist_changes"] == [
        {"ticker": "PYPL", "action": "add", "status": "executed", "error": None}
    ]
    assert actions["trades"] == [
        {"ticker": "PYPL", "side": "buy", "quantity": 5, "status": "executed",
         "price": NEW_TICKER_PRICE, "error": None}
    ]
    assert _position("PYPL")["quantity"] == 5


async def test_sell_then_remove(cache, source, llm_reply):
    llm_reply["reply"] = _reply(trades=[("AAPL", "buy", 2)])
    await chat.handle_chat("buy", cache, source)

    llm_reply["reply"] = _reply(trades=[("AAPL", "sell", 2)], changes=[("AAPL", "remove")])
    result = await chat.handle_chat("sell and remove", cache, source)

    actions = result["message"]["actions"]
    assert [a["status"] for a in actions["trades"]] == ["executed"]
    assert actions["watchlist_changes"][0]["status"] == "executed"
    assert _position("AAPL") is None
    assert not _watched("AAPL")


async def test_remove_with_open_position_fails(cache, source, llm_reply):
    llm_reply["reply"] = _reply(trades=[("AAPL", "buy", 1)], changes=[("AAPL", "remove")])
    result = await chat.handle_chat("x", cache, source)
    change = result["message"]["actions"]["watchlist_changes"][0]
    assert change["status"] == "failed"
    assert change["error"]["code"] == "position_open"
    assert _watched("AAPL")


async def test_failed_action_does_not_stop_later_ones(cache, source, llm_reply):
    llm_reply["reply"] = _reply(
        trades=[("TSLA", "buy", 500), ("ZZZZ", "buy", 1), ("MSFT", "buy", 1), ("NVDA", "sell", 1)]
    )
    result = await chat.handle_chat("x", cache, source)
    trades = result["message"]["actions"]["trades"]
    assert [(t["ticker"], t["status"]) for t in trades] == [
        ("TSLA", "failed"), ("ZZZZ", "failed"), ("MSFT", "executed"), ("NVDA", "failed"),
    ]
    assert [t["error"]["code"] for t in trades if t["error"]] == [
        "insufficient_cash", "ticker_not_watched", "insufficient_shares",
    ]
    assert trades[0]["price"] is None
    assert set(trades[0]["error"]) == {"code", "message"}
    assert _position("MSFT")["quantity"] == 1


async def test_llm_error_stores_only_user_message(cache, source, llm_reply):
    llm_reply["reply"] = AppError("llm_error", "down", 502)
    with pytest.raises(AppError) as exc:
        await chat.handle_chat("hello", cache, source)
    assert exc.value.code == "llm_error"

    messages = stored_messages()
    assert [(m["role"], m["content"], m["actions"]) for m in messages] == [("user", "hello", None)]


async def test_messages_stored_and_returned(cache, source, llm_reply):
    llm_reply["reply"] = _reply(message="Hi there")
    result = await chat.handle_chat("hello", cache, source)

    msg = result["message"]
    assert msg["role"] == "assistant" and msg["content"] == "Hi there"
    assert msg["actions"] == {"watchlist_changes": [], "trades": []}
    assert set(msg) == {"id", "role", "content", "actions", "created_at"}

    stored = stored_messages()
    assert [m["role"] for m in stored] == ["user", "assistant"]
    assert stored[1] == msg


async def test_prompt_contains_context_and_history(cache, source, llm_reply):
    llm_reply["reply"] = _reply(trades=[("TSLA", "buy", 500)], message="first")
    await chat.handle_chat("one", cache, source)
    await chat.handle_chat("two", cache, source)

    sent = llm_reply["sent"][1]
    assert sent[0]["role"] == "system" and "FinAlly" in sent[0]["content"]
    assert "Cash: $10,000.00" in sent[1]["content"]
    assert "AAPL: $100.00" in sent[1]["content"]
    assert [(m["role"], m["content"].split("\n")[0]) for m in sent[2:]] == [
        ("user", "one"), ("assistant", "first"), ("user", "two"),
    ]
    assert "insufficient_cash" in sent[3]["content"]  # failed action visible next turn


async def test_history_limited_to_20(cache, source, llm_reply):
    for i in range(12):
        await chat.handle_chat(f"m{i}", cache, source)
    sent = llm_reply["sent"][-1]
    history = sent[2:-1]
    assert len(history) == 20
    assert history[-1]["content"] == "ok" and sent[-1]["content"] == "m11"


async def test_mock_mode_buy_executes(cache, source, mock_mode, llm_reply):
    result = await chat.handle_chat("Buy 3 shares of PYPL", cache, source)
    msg = result["message"]
    assert msg["content"] == "[mock] Buying 3 shares of PYPL."
    assert msg["actions"]["trades"][0]["status"] == "executed"
    assert _position("PYPL")["quantity"] == 3
    assert llm_reply["sent"] == []  # real LLM never called


async def test_mock_mode_summary(cache, source, mock_mode):
    result = await chat.handle_chat("how am I doing", cache, source)
    assert result["message"]["content"] == (
        "[mock] Your portfolio is worth $10,000.00 with $10,000.00 in cash."
    )


async def test_mock_mode_buy_zero_fails_cleanly(cache, source, mock_mode):
    result = await chat.handle_chat("buy 0 aapl", cache, source)
    trade = result["message"]["actions"]["trades"][0]
    assert trade["status"] == "failed"
    assert trade["error"]["code"] == "invalid_request"
