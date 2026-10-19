"""HTTP layer for /api/chat, mounted on a minimal app with the AppError handler."""

import pytest
from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.testclient import TestClient

from app.errors import AppError
from app.llm.router import router

from .conftest import stored_messages


@pytest.fixture
def client(cache, source, mock_mode):
    app = FastAPI()
    app.include_router(router)
    app.state.price_cache = cache
    app.state.market_source = source

    @app.exception_handler(AppError)
    async def _handle(_request, exc: AppError):
        return JSONResponse({"error": exc.to_dict()}, status_code=exc.status_code)

    return TestClient(app)


def test_post_chat_returns_message(client):
    resp = client.post("/api/chat", json={"message": "  add PYPL  "})
    assert resp.status_code == 200
    msg = resp.json()["message"]
    assert msg["content"] == "[mock] Adding PYPL to your watchlist."
    assert msg["actions"]["watchlist_changes"][0]["status"] == "executed"
    assert stored_messages()[0]["content"] == "add PYPL"


@pytest.mark.parametrize("body", [{"message": ""}, {"message": "   "}])
def test_empty_message_rejected(client, body):
    resp = client.post("/api/chat", json=body)
    assert resp.status_code == 422
    assert resp.json()["error"]["code"] == "invalid_request"
    assert stored_messages() == []


def test_missing_message_rejected(client):
    assert client.post("/api/chat", json={}).status_code == 422


def test_llm_error_is_502(client, monkeypatch):
    monkeypatch.setenv("LLM_MOCK", "false")
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    resp = client.post("/api/chat", json={"message": "hello"})
    assert resp.status_code == 502
    assert resp.json()["error"]["code"] == "llm_error"
    assert [m["role"] for m in stored_messages()] == ["user"]


def test_get_history(client):
    assert client.get("/api/chat").json() == {"messages": []}
    client.post("/api/chat", json={"message": "hello"})
    messages = client.get("/api/chat").json()["messages"]
    assert [(m["role"], m["actions"]) for m in messages] == [
        ("user", None),
        ("assistant", {"watchlist_changes": [], "trades": []}),
    ]


def test_get_history_last_50_oldest_first(client):
    for i in range(30):
        client.post("/api/chat", json={"message": f"m{i}"})
    messages = client.get("/api/chat").json()["messages"]
    assert len(messages) == 50
    assert messages[0]["content"] == "m5"
    assert messages[-1]["role"] == "assistant"
