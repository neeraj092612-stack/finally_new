"""Structured output schema the LLM must answer with."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


class TradeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticker: str = Field(description="Ticker symbol, e.g. AAPL")
    side: Literal["buy", "sell"]
    quantity: int = Field(description="Number of whole shares, a positive integer")

    # A validator rather than Field(gt=0) keeps the JSON schema free of numeric
    # constraints that strict structured-output providers may reject.
    @field_validator("quantity")
    @classmethod
    def _positive(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("quantity must be a positive integer")
        return value


class WatchlistChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    ticker: str = Field(description="Ticker symbol, e.g. PYPL")
    action: Literal["add", "remove"]


class ChatResponse(BaseModel):
    """What the LLM returns. All fields are required; the arrays may be empty."""

    model_config = ConfigDict(extra="forbid")

    message: str = Field(description="Conversational reply shown to the user")
    trades: list[TradeRequest] = Field(description="Trades to execute now; empty if none")
    watchlist_changes: list[WatchlistChange] = Field(
        description="Watchlist additions/removals to apply now; empty if none"
    )
