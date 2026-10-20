"""Pytest configuration and fixtures."""

import pytest


@pytest.fixture(autouse=True)
def _no_massive_key(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep in-process lifespans on the simulator, whatever the developer's environment holds."""
    monkeypatch.delenv("MASSIVE_API_KEY", raising=False)
