"""Settings.from_env falls back to repo-local paths and honours explicit overrides."""

from __future__ import annotations

from pathlib import Path

import pytest

from app.config import REPO_ROOT, Settings


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("DB_PATH", raising=False)
    monkeypatch.delenv("STATIC_DIR", raising=False)


class TestDbPath:
    def test_unset_falls_back_to_repo_db(self) -> None:
        assert Settings.from_env().db_path == REPO_ROOT / "db" / "finally.db"

    def test_whitespace_only_falls_back_to_repo_db(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_PATH", "   ")

        assert Settings.from_env().db_path == REPO_ROOT / "db" / "finally.db"

    def test_explicit_value_is_used_as_given(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("DB_PATH", "data/x.db")

        assert Settings.from_env().db_path == Path("data/x.db")


class TestStaticDir:
    def test_unset_defaults_to_frontend_export(self) -> None:
        assert Settings.from_env().static_dir == REPO_ROOT / "frontend" / "out"

    def test_explicit_value_is_used(self, monkeypatch: pytest.MonkeyPatch) -> None:
        monkeypatch.setenv("STATIC_DIR", "/app/static")

        assert Settings.from_env().static_dir == Path("/app/static")
