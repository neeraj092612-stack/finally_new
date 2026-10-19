"""Structured output schema parsing."""

import pytest
from pydantic import ValidationError

from app.llm.schema import ChatResponse


def test_message_only_with_empty_arrays():
    r = ChatResponse.model_validate_json('{"message": "Hi", "trades": [], "watchlist_changes": []}')
    assert r.message == "Hi"
    assert r.trades == [] and r.watchlist_changes == []


def test_full_response():
    r = ChatResponse.model_validate_json(
        '{"message": "Done", '
        '"trades": [{"ticker": "AAPL", "side": "buy", "quantity": 10},'
        ' {"ticker": "msft", "side": "sell", "quantity": 1}], '
        '"watchlist_changes": [{"ticker": "PYPL", "action": "add"}, {"ticker": "V", "action": "remove"}]}'
    )
    assert [(t.ticker, t.side, t.quantity) for t in r.trades] == [("AAPL", "buy", 10), ("msft", "sell", 1)]
    assert [(c.ticker, c.action) for c in r.watchlist_changes] == [("PYPL", "add"), ("V", "remove")]


@pytest.mark.parametrize(
    "payload",
    [
        '{"trades": [], "watchlist_changes": []}',  # missing message
        '{"message": "x", "watchlist_changes": []}',  # missing trades
        '{"message": "x", "trades": []}',  # missing watchlist_changes
        '{"message": "x", "trades": [{"ticker": "A", "side": "hold", "quantity": 1}], "watchlist_changes": []}',
        '{"message": "x", "trades": [{"ticker": "A", "side": "buy", "quantity": 0}], "watchlist_changes": []}',
        '{"message": "x", "trades": [{"ticker": "A", "side": "buy", "quantity": -3}], "watchlist_changes": []}',
        '{"message": "x", "trades": [{"ticker": "A", "side": "buy", "quantity": 1.5}], "watchlist_changes": []}',
        '{"message": "x", "trades": [], "watchlist_changes": [{"ticker": "A", "action": "toggle"}]}',
        '{"message": "x", "trades": [], "watchlist_changes": [], "extra": 1}',
        "not json at all",
    ],
)
def test_invalid_payloads_rejected(payload):
    with pytest.raises(ValidationError):
        ChatResponse.model_validate_json(payload)


def test_json_schema_marks_all_fields_required():
    schema = ChatResponse.model_json_schema()
    assert set(schema["required"]) == {"message", "trades", "watchlist_changes"}
