"""Runtime settings read from environment variables."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

# backend/app/config.py -> repository root
REPO_ROOT = Path(__file__).resolve().parents[2]


@dataclass(frozen=True, slots=True)
class Settings:
    """Server configuration; Docker sets both paths explicitly."""

    db_path: Path
    static_dir: Path | None

    @classmethod
    def from_env(cls) -> Settings:
        """Build settings from DB_PATH and STATIC_DIR, falling back to repo-local defaults."""
        db_path = os.environ.get("DB_PATH", "").strip()
        static_dir = os.environ.get("STATIC_DIR", "").strip()
        return cls(
            db_path=Path(db_path) if db_path else REPO_ROOT / "db" / "finally.db",
            static_dir=Path(static_dir) if static_dir else REPO_ROOT / "frontend" / "out",
        )
