"""LLM client: request parameters and failure handling (litellm.completion is always mocked)."""

from types import SimpleNamespace

import pytest

from app.errors import AppError
from app.llm import client
from app.llm.schema import ChatResponse

MESSAGES = [{"role": "user", "content": "hi"}]


def _response(content):
    return SimpleNamespace(choices=[SimpleNamespace(message=SimpleNamespace(content=content))])


@pytest.fixture(autouse=True)
def api_key(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")


async def test_valid_response_parsed_and_request_shape(monkeypatch):
    calls = []

    def fake_completion(**kwargs):
        calls.append(kwargs)
        return _response('{"message": "ok", "trades": [], "watchlist_changes": []}')

    monkeypatch.setattr(client, "completion", fake_completion)
    result = await client.call_llm(MESSAGES)

    assert result == ChatResponse(message="ok", trades=[], watchlist_changes=[])
    kwargs = calls[0]
    assert kwargs["model"] == "openrouter/openai/gpt-oss-120b"
    assert kwargs["extra_body"] == {"provider": {"order": ["cerebras"]}}
    assert kwargs["response_format"] is ChatResponse
    assert kwargs["messages"] == MESSAGES


@pytest.mark.parametrize(
    "content",
    [
        "not json",
        '{"message": "missing arrays"}',
        '{"message": "x", "trades": [{"ticker": "A", "side": "buy", "quantity": 0}], "watchlist_changes": []}',
        "",
        None,
    ],
)
async def test_bad_output_is_llm_error(monkeypatch, content):
    monkeypatch.setattr(client, "completion", lambda **_: _response(content))
    with pytest.raises(AppError) as exc:
        await client.call_llm(MESSAGES)
    assert exc.value.code == "llm_error"
    assert exc.value.status_code == 502


async def test_exception_is_llm_error(monkeypatch):
    def boom(**_):
        raise RuntimeError("network down")

    monkeypatch.setattr(client, "completion", boom)
    with pytest.raises(AppError) as exc:
        await client.call_llm(MESSAGES)
    assert exc.value.code == "llm_error"


async def test_missing_key_is_llm_error_without_calling(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY")

    def never(**_):  # pragma: no cover - must not be called
        raise AssertionError("completion called without a key")

    monkeypatch.setattr(client, "completion", never)
    with pytest.raises(AppError) as exc:
        await client.call_llm(MESSAGES)
    assert exc.value.code == "llm_error"


async def test_timeout_is_llm_error(monkeypatch):
    import time

    monkeypatch.setattr(client, "TIMEOUT_SECONDS", -4.9)  # wait_for timeout = 0.1s
    monkeypatch.setattr(client, "completion", lambda **_: time.sleep(0.5))
    with pytest.raises(AppError) as exc:
        await client.call_llm(MESSAGES)
    assert exc.value.code == "llm_error"
    assert "too long" in exc.value.message
