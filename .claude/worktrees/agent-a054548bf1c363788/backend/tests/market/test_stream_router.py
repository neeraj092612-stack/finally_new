"""Tests for the SSE router factory and the event generator."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path

import pytest

from app.config import Settings
from app.main import create_app
from app.market import PriceCache, create_stream_router
from app.market import stream as stream_module

STREAM_PATH = "/api/stream/prices"


class FakeRequest:
    """Minimal stand-in for starlette's Request as used by the generator."""

    client = None

    def __init__(self, disconnect_after: int | None = None) -> None:
        self.disconnect_after = disconnect_after
        self.disconnected = False
        self.polls = 0

    async def is_disconnected(self) -> bool:
        self.polls += 1
        if self.disconnected:
            return True
        return self.disconnect_after is not None and self.polls > self.disconnect_after


async def _collect(cache: PriceCache, request: FakeRequest, interval: float = 0.01) -> list[str]:
    """Drain generate_events until the request disconnects."""
    return [chunk async for chunk in stream_module.generate_events(cache, request, interval)]


def _data_chunks(chunks: list[str]) -> list[dict]:
    return [json.loads(c.removeprefix("data: ")) for c in chunks if c.startswith("data: ")]


async def _wait_for(predicate, timeout: float = 2.0) -> None:
    deadline = asyncio.get_running_loop().time() + timeout
    while not predicate():
        if asyncio.get_running_loop().time() > deadline:
            raise AssertionError("condition not reached before timeout")
        await asyncio.sleep(0.005)


def _stream_route_count(app) -> int:
    return sum(1 for route in app.routes if getattr(route, "path", None) == STREAM_PATH)


class TestCreateStreamRouter:
    def test_each_call_builds_its_own_router_with_one_route(self):
        first = create_stream_router(PriceCache())
        second = create_stream_router(PriceCache())

        assert first is not second
        assert [r.path for r in first.routes] == [STREAM_PATH]
        assert [r.path for r in second.routes] == [STREAM_PATH]

    def test_no_module_level_router_remains(self):
        assert not hasattr(stream_module, "router")

    def test_each_app_registers_the_stream_route_once(self, tmp_path: Path):
        first = create_app(Settings(db_path=tmp_path / "a.db", static_dir=None))
        second = create_app(Settings(db_path=tmp_path / "b.db", static_dir=None))

        assert _stream_route_count(first) == 1
        assert _stream_route_count(second) == 1


@pytest.mark.asyncio
class TestGenerateEvents:
    async def test_first_chunk_is_the_retry_directive(self):
        cache = PriceCache()
        cache.update("AAPL", 190.0)

        chunks = await _collect(cache, FakeRequest(disconnect_after=1))

        assert chunks[0] == "retry: 1000\n\n"

    async def test_empty_cache_yields_only_the_retry_line(self):
        chunks = await _collect(PriceCache(), FakeRequest(disconnect_after=3))

        assert chunks == ["retry: 1000\n\n"]

    async def test_event_carries_every_ticker_with_day_change_fields(self):
        cache = PriceCache()
        cache.update("AAPL", 190.0, reference_price=188.0)
        cache.update("MSFT", 420.0)
        # A second AAPL tick is the only change since MSFT's update; MSFT must still be present.
        cache.update("AAPL", 191.0)

        chunks = await _collect(cache, FakeRequest(disconnect_after=1))

        events = _data_chunks(chunks)
        assert len(events) == 1
        assert set(events[0]) == {"AAPL", "MSFT"}
        for payload in events[0].values():
            assert "reference_price" in payload
            assert "day_change_percent" in payload
        assert events[0]["AAPL"]["reference_price"] == 188.0

    async def test_unchanged_ticker_is_repeated_in_the_next_event(self):
        cache = PriceCache()
        cache.update("AAPL", 190.0)
        cache.update("MSFT", 420.0)
        request = FakeRequest()
        chunks: list[str] = []

        async def run() -> None:
            async for chunk in stream_module.generate_events(cache, request, 0.01):
                chunks.append(chunk)

        task = asyncio.create_task(run())
        await _wait_for(lambda: len(_data_chunks(chunks)) >= 1)
        cache.update("AAPL", 191.0)  # only AAPL changes
        await _wait_for(lambda: len(_data_chunks(chunks)) >= 2)
        request.disconnected = True
        await task

        assert set(_data_chunks(chunks)[1]) == {"AAPL", "MSFT"}

    async def test_concurrent_generators_are_independent(self):
        cache = PriceCache()
        cache.update("AAPL", 190.0)
        request_a, request_b = FakeRequest(), FakeRequest()
        chunks_a: list[str] = []
        chunks_b: list[str] = []

        async def run(request: FakeRequest, sink: list[str]) -> None:
            async for chunk in stream_module.generate_events(cache, request, 0.01):
                sink.append(chunk)

        task_a = asyncio.create_task(run(request_a, chunks_a))
        task_b = asyncio.create_task(run(request_b, chunks_b))
        await _wait_for(lambda: _data_chunks(chunks_a) and _data_chunks(chunks_b))

        request_a.disconnected = True
        await task_a
        assert not task_b.done()

        cache.update("AAPL", 192.0)
        await _wait_for(lambda: len(_data_chunks(chunks_b)) >= 2)
        request_b.disconnected = True
        await task_b

        assert len(_data_chunks(chunks_a)) == 1
        assert len(_data_chunks(chunks_b)) == 2
