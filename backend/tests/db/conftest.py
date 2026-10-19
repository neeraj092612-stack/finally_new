"""Fixtures for database tests: a fresh, initialized SQLite file per test."""

import pytest

from app import db


@pytest.fixture
def db_path(tmp_path, monkeypatch):
    path = tmp_path / "test.db"
    monkeypatch.setenv("DB_PATH", str(path))
    db.init_db(path)
    return path


@pytest.fixture
def conn(db_path):
    with db.connect(db_path) as connection:
        yield connection
