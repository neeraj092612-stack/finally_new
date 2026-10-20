"""Data models for market data."""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Immutable snapshot of a single ticker's price at a point in time.

    `price` and `previous_price` are the 2 dp display values. `raw_price` and
    `raw_previous_price` hold the unrounded values so direction reflects every real
    move, even one smaller than a cent (D-06). They are internal and never serialized.
    `reference_price` is the day-change baseline (D-18).
    """

    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)  # Unix seconds
    reference_price: float | None = None
    raw_price: float | None = None
    raw_previous_price: float | None = None

    @property
    def _cur(self) -> float:
        """Current price at full precision when known, else the display price."""
        return self.raw_price if self.raw_price is not None else self.price

    @property
    def _prev(self) -> float:
        """Previous price at full precision when known, else the display price."""
        return (
            self.raw_previous_price if self.raw_previous_price is not None else self.previous_price
        )

    @property
    def change(self) -> float:
        """Absolute price change from previous update."""
        return round(self._cur - self._prev, 4)

    @property
    def change_percent(self) -> float:
        """Percentage change from previous update."""
        if self._prev == 0:
            return 0.0
        return round((self._cur - self._prev) / self._prev * 100, 4)

    @property
    def direction(self) -> str:
        """'up', 'down', or 'flat' ('flat' only when the raw price did not change)."""
        if self._cur > self._prev:
            return "up"
        elif self._cur < self._prev:
            return "down"
        return "flat"

    @property
    def day_change_percent(self) -> float | None:
        """Percentage change of the display price against the baseline, or None."""
        if not self.reference_price:
            return None
        return round((self.price - self.reference_price) / self.reference_price * 100, 2)

    def to_dict(self) -> dict:
        """Serialize for JSON / SSE transmission."""
        return {
            "ticker": self.ticker,
            "price": self.price,
            "previous_price": self.previous_price,
            "timestamp": self.timestamp,
            "change": self.change,
            "change_percent": self.change_percent,
            "direction": self.direction,
            "reference_price": self.reference_price,
            "day_change_percent": self.day_change_percent,
        }
