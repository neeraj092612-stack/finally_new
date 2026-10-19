"""Ticker normalization and validation."""

from __future__ import annotations

import re

from app.errors import AppError

TICKER_RE = re.compile(r"^[A-Z][A-Z0-9.]{0,9}$")


def normalize_ticker(raw: str) -> str:
    """Trim and uppercase a ticker; raise ``invalid_ticker`` if it fails the format rule."""
    ticker = raw.strip().upper() if isinstance(raw, str) else ""
    if not TICKER_RE.match(ticker):
        shown = raw.strip() if isinstance(raw, str) else str(raw)
        raise AppError(
            "invalid_ticker",
            f'"{shown}" is not a valid ticker symbol. Use 1-10 letters, digits or dots, '
            "starting with a letter.",
            400,
        )
    return ticker
