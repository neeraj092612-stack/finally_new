# Market Data Backend — Detailed Design

**Date:** 2026-10-15
**Scope:** everything under `backend/app/market/`, plus how the rest of the backend (lifespan, watchlist, trades, portfolio, chat) uses it.
**Inputs:** `planning/PLAN.md` (Sections 6, 8, 13), `planning/MARKET_DATA_SUMMARY.md`, `planning/archive/*` (interface, simulator, Massive API reference, the earlier design and its code review), and the current code in `backend/app/market/` and `backend/tests/market/`.

This document replaces `planning/archive/MARKET_DATA_DESIGN.md` as the reference design. That earlier document described the code as first built. This one is checked against the code as it now stands **and** against the API contract that PLAN.md has since added (Section 8). Where they differ, this document says what to change and gives the code.

---

## Table of Contents

0. [Status and Change Summary](#0-status-and-change-summary)
1. [Requirements Traceability](#1-requirements-traceability)
2. [Architecture](#2-architecture)
3. [File Layout](#3-file-layout)
4. [Ticker Normalization — `tickers.py` (new)](#4-ticker-normalization--tickerspy-new)
5. [Data Model — `models.py`](#5-data-model--modelspy)
6. [Price Cache — `cache.py`](#6-price-cache--cachepy)
7. [Unified Interface — `interface.py`](#7-unified-interface--interfacepy)
8. [Seed Prices and Parameters — `seed_prices.py`](#8-seed-prices-and-parameters--seed_pricespy)
9. [GBM Simulator — `simulator.py`](#9-gbm-simulator--simulatorpy)
10. [Massive API Client — `massive_client.py`](#10-massive-api-client--massive_clientpy)
11. [Factory — `factory.py`](#11-factory--factorypy)
12. [SSE Streaming — `stream.py`](#12-sse-streaming--streampy)
13. [Package Exports — `__init__.py`](#13-package-exports--__init__py)
14. [FastAPI Integration (Lifespan and Dependencies)](#14-fastapi-integration-lifespan-and-dependencies)
15. [How Other Modules Use Market Data](#15-how-other-modules-use-market-data)
16. [Optional: Server-Side Price History (PLAN item 13)](#16-optional-server-side-price-history-plan-item-13)
17. [Testing](#17-testing)
18. [Edge Cases and Failure Modes](#18-edge-cases-and-failure-modes)
19. [Configuration](#19-configuration)
20. [Decisions to Write Back into PLAN.md](#20-decisions-to-write-back-into-planmd)
21. [Implementation Checklist](#21-implementation-checklist)

---

## 0. Status and Change Summary

The market data subsystem exists and 73 unit tests pass. Reviewing it against PLAN.md and against the real `massive` package found the following gaps. Each item is designed in full below.

| # | Gap | Severity | Section |
|---|---|---|---|
| G1 | **Massive parsing is broken against the real API.** `_poll_once` reads `snap.last_trade.timestamp`, but the `massive` package's `LastTrade` model has no `timestamp` field. It has `sip_timestamp`, in **nanoseconds**. Every snapshot raises `AttributeError` and is skipped, so in Massive mode the cache never receives a price. The tests build snapshots with `MagicMock`, which invents any attribute you ask for, so they pass. | **High** | 10.3, 17.2 |
| G2 | `day_change_percent` (required by `GET /api/watchlist`) has no data behind it. `PriceUpdate` only knows the previous tick. | High | 5, 6, 9, 10 |
| G3 | Massive removal race: a poll that is in flight when a ticker is removed writes that ticker back into the cache afterwards, so a removed ticker reappears in the SSE stream until restart. | Medium | 10.4 |
| G4 | Massive passes its live `self._tickers` list into a worker thread while the event loop may `append` to it. | Low | 10.4 |
| G5 | Ticker normalization (`^[A-Z][A-Z0-9.]{0,9}$`, trim, uppercase) is not implemented anywhere. Massive uppercases; the simulator does not. | Medium | 4 |
| G6 | `stream.py` registers its route on a **module-level** router, so calling `create_stream_router()` twice (for example, one app per test) registers `/prices` twice on the same object. This was flagged in the archived review (3.6) and is still open. | Low | 12 |
| G7 | The SSE stream sends nothing while prices are unchanged (Massive mode between polls, or all evening when the market is closed). Idle proxies and some browsers drop silent connections. | Low | 12 |
| G8 | Massive keeps polling at the same rate after a 429 or a bad key, logging an error each time. | Low | 10.5 |
| G9 | `PriceCache.update` uses `timestamp or time.time()`, so a timestamp of `0.0` is silently replaced. `version` is read without the lock. | Trivial | 6 |

The archived review's other findings (build config, lazy imports, return annotation, `get_tickers()`, correlation constants, unused test imports) are already fixed in the code.

Nothing in this design changes the SSE fields that already exist. It **adds** two fields to each SSE ticker object (`reference_price`, `day_change_percent`). Existing consumers ignore them.

---

## 1. Requirements Traceability

| Requirement (PLAN.md) | Where it is met |
|---|---|
| Two implementations, one interface; selected by `MASSIVE_API_KEY` (§5, §6) | `interface.py`, `factory.py` |
| Simulator: GBM, ~500ms, correlated moves, random 2–5% events, realistic seeds (§6) | `simulator.py`, `seed_prices.py` |
| Massive: REST polling of the union of watched tickers, 15s on free tier, configurable (§6) | `massive_client.py`, `MASSIVE_POLL_INTERVAL` |
| Shared cache: latest price, previous price, timestamp per ticker (§6) | `cache.py` |
| `GET /api/stream/prices`: `retry: 1000`, one unnamed event ~every 500ms when something changed, all tickers keyed by ticker, Unix-seconds float timestamp (§6, §8) | `stream.py` |
| Tickers trimmed, uppercased, must match `^[A-Z][A-Z0-9.]{0,9}$` (§8 Conventions) | `tickers.py` |
| Fill price is the cached price at execution; `price_unavailable` (409) if none (§8 trade rule 2) | §15.3 |
| Simulator prices a newly added ticker immediately; Massive on the next poll (§8 trade rule 2) | §9.3, §10 |
| `GET /api/watchlist` entries carry `price`, `previous_price`, `direction`, `day_change_percent`, all `null` while unpriced (§8) | §5, §15.2 |
| `POST /api/watchlist` registers the ticker with the source; `DELETE` removes it (§8) | §15.1 |
| A ticker with an open position cannot be removed, so held tickers always have a live price (§8) | §15.1 |
| DB init and startup snapshot happen in the lifespan (§13 item 8) | §14 |

---

## 2. Architecture

```
                     ┌──────────────────────────────────────────┐
                     │        MarketDataSource (ABC)            │
                     │ start / stop / add_ticker / remove_ticker│
                     │ get_tickers                              │
                     └──────────────┬───────────────────────────┘
                 ┌──────────────────┴──────────────────┐
     ┌───────────▼───────────┐             ┌───────────▼────────────┐
     │ SimulatorDataSource   │             │ MassiveDataSource      │
     │  GBMSimulator.step()  │             │  RESTClient            │
     │  every 0.5s (asyncio) │             │  .get_snapshot_all()   │
     │                       │             │  every 15s (thread)    │
     └───────────┬───────────┘             └───────────┬────────────┘
                 │ cache.update(t, price, ref)         │
                 └──────────────────┬──────────────────┘
                          ┌─────────▼─────────┐
                          │    PriceCache     │   dict[ticker → PriceUpdate]
                          │  (Lock, version)  │   + monotonic version counter
                          └─────────┬─────────┘
       ┌───────────────┬────────────┼──────────────┬─────────────────┐
       ▼               ▼            ▼              ▼                 ▼
  SSE /api/stream  GET /api/    POST /api/     GET /api/        Chat prompt
  /prices          watchlist    portfolio/     portfolio        context
  (poll version    (entry       trade (fill    (valuation)
   every 0.5s)      builder)     price)
```

### Rules

1. **The cache is the only read path.** Nothing downstream ever asks a data source for a price. Sources push; consumers read.
2. **One writer at a time.** Exactly one source is created per process, by the factory, in the lifespan.
3. **The watchlist table is the source of truth for which tickers exist.** The data source's ticker set is a mirror of it, kept in sync by the watchlist routes (and the chat actions, which call the same functions).
4. **Sources never raise into the event loop.** Background loops log and continue. Downstream code handles absence (`cache.get()` returns `None`).

### Concurrency model

| Component | Runs on | Touches the cache from |
|---|---|---|
| `SimulatorDataSource._run_loop` | event loop (asyncio task) | event loop |
| `MassiveDataSource._poll_once` | event loop; the HTTP call runs in `asyncio.to_thread` | event loop (results are written after the thread returns) |
| SSE generators, API routes | event loop | event loop |

Every cache write currently happens on the event loop. The `threading.Lock` in `PriceCache` is still kept: it is cheap (uncontended), it makes the cache safe if a future source writes from a thread, and it keeps reads of `version` + `get_all()` consistent on free-threaded Python builds.

---

## 3. File Layout

```
backend/app/market/
├── __init__.py         # Public API re-exports                         (update)
├── tickers.py          # normalize_ticker(), TICKER_PATTERN, InvalidTicker (NEW)
├── models.py           # PriceUpdate (+ reference_price, day_change_percent) (update)
├── cache.py            # PriceCache (+ reference price handling)        (update)
├── interface.py        # MarketDataSource ABC                           (unchanged)
├── seed_prices.py      # SEED_PRICES, TICKER_PARAMS, correlation consts (unchanged)
├── simulator.py        # GBMSimulator + SimulatorDataSource             (update)
├── massive_client.py   # MassiveDataSource                              (update: G1, G3, G4, G8)
├── factory.py          # create_market_data_source()                    (update: poll interval env)
└── stream.py           # create_stream_router()                         (update: G6, G7)
```

---

## 4. Ticker Normalization — `tickers.py` (new)

PLAN §8: "Tickers are normalized by the backend (trimmed, uppercased) and must match `^[A-Z][A-Z0-9.]{0,9}$`." This rule is needed by the watchlist routes, the trade route, the chat action executor and both data sources. It belongs in the market package because a ticker symbol is a market-data concept and because the sources need it too.

```python
"""Ticker symbol normalization and validation."""

from __future__ import annotations

import re

TICKER_PATTERN = re.compile(r"^[A-Z][A-Z0-9.]{0,9}$")


class InvalidTicker(ValueError):
    """Raised when a ticker does not match TICKER_PATTERN after normalization."""

    def __init__(self, raw: object) -> None:
        self.raw = raw
        super().__init__(f"'{raw}' is not a valid ticker symbol.")


def normalize_ticker(raw: object) -> str:
    """Trim and uppercase a ticker, then validate it.

    >>> normalize_ticker("  aapl ")
    'AAPL'
    >>> normalize_ticker("brk.b")
    'BRK.B'
    >>> normalize_ticker("1ABC")
    Traceback (most recent call last):
    ...
    app.market.tickers.InvalidTicker: '1ABC' is not a valid ticker symbol.
    """
    if not isinstance(raw, str):
        raise InvalidTicker(raw)
    ticker = raw.strip().upper()
    if not TICKER_PATTERN.fullmatch(ticker):
        raise InvalidTicker(raw)
    return ticker
```

### Where it is called

| Caller | On `InvalidTicker` |
|---|---|
| `POST /api/watchlist`, `DELETE /api/watchlist/{ticker}`, `POST /api/portfolio/trade` | Map to `invalid_ticker` (400) in the API error handler (§15.4) |
| Chat action executor | Record a failed action with `invalid_ticker` |
| `SimulatorDataSource` / `MassiveDataSource` `add_ticker` / `remove_ticker` | Defensive only: callers already pass normalized symbols. Sources call `normalize_ticker` so that a direct caller (demo script, test) cannot create a lowercase duplicate. |

Examples:

| Input | Result |
|---|---|
| `"aapl"` | `"AAPL"` |
| `"  BRK.B "` | `"BRK.B"` |
| `"V"` | `"V"` |
| `""`, `"1ABC"`, `"AAPL$"`, `"ABCDEFGHIJK"` (11 chars), `5` | `InvalidTicker` |

---

## 5. Data Model — `models.py`

`PriceUpdate` is the only type that leaves the market data layer. It gains one stored field, `reference_price`, and one derived property, `day_change_percent`.

### 5.1 The "day change" baseline (PLAN item 12)

| Source | `reference_price` | Why |
|---|---|---|
| Simulator | The ticker's **seed price** (the first price the cache saw for it). | The simulator has no previous close. The seed is a stable baseline for the session; a "day" in the demo is the process lifetime. |
| Massive | `snapshot.prev_day.close` (previous session's close). | This is the standard definition of day change, and the API provides it in the same snapshot call at no extra cost. |
| Massive, `prev_day` missing | Keep the last known reference; if there never was one, the first price seen. | Same fallback as the simulator. |

So `day_change_percent = (price − reference_price) / reference_price × 100`, rounded to 2 decimals (PLAN example: `0.65`).

### 5.2 Code

```python
"""Data models for market data."""

from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Immutable snapshot of a single ticker's price at a point in time."""

    ticker: str
    price: float
    previous_price: float
    timestamp: float = field(default_factory=time.time)  # Unix seconds
    # Baseline for day change: previous close (Massive) or first price seen (simulator).
    reference_price: float | None = None

    @property
    def change(self) -> float:
        """Absolute price change from the previous update."""
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        """Percentage change from the previous update."""
        if self.previous_price == 0:
            return 0.0
        return round((self.price - self.previous_price) / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        """'up', 'down', or 'flat' against the previous update."""
        if self.price > self.previous_price:
            return "up"
        if self.price < self.previous_price:
            return "down"
        return "flat"

    @property
    def day_change_percent(self) -> float | None:
        """Percentage change against reference_price, or None if there is no baseline."""
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
```

`reference_price` has a default, so every existing `PriceUpdate(...)` call and test keeps working.

### 5.3 Example

```python
>>> u = PriceUpdate("AAPL", price=191.24, previous_price=191.10,
...                 timestamp=1791100800.12, reference_price=190.00)
>>> u.change, u.change_percent, u.direction, u.day_change_percent
(0.14, 0.0733, 'up', 0.65)
```

---

## 6. Price Cache — `cache.py`

### 6.1 Behavior

- `update(ticker, price, timestamp=None, reference_price=None)`:
  - `previous_price` = the cached price, or `price` itself on the first update (so the first event is `"flat"`).
  - `reference_price`: the argument if given; else the cached entry's reference; else, on the first update, `price`.
  - Prices are rounded to 2 decimals, as now.
  - Bumps `version`.
- `remove(ticker)` also bumps `version`, so SSE clients learn about the removal on the next tick. Today a removal is invisible to the stream until some other price changes; in simulator mode that is 500ms, in Massive mode up to 15s.
- `version` is read under the lock (G9).

### 6.2 Code

```python
"""Thread-safe in-memory price cache."""

from __future__ import annotations

import time
from threading import Lock

from .models import PriceUpdate


class PriceCache:
    """Thread-safe in-memory cache of the latest price for each ticker.

    Writers: SimulatorDataSource or MassiveDataSource (one at a time).
    Readers: SSE streaming endpoint, portfolio valuation, trade execution.
    """

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()
        self._version: int = 0  # Monotonically increasing; bumped on every change

    def update(
        self,
        ticker: str,
        price: float,
        timestamp: float | None = None,
        reference_price: float | None = None,
    ) -> PriceUpdate:
        """Record a new price for a ticker. Returns the created PriceUpdate.

        If this is the first update for the ticker, previous_price == price
        (direction='flat') and, unless given, reference_price == price.
        """
        with self._lock:
            ts = time.time() if timestamp is None else timestamp
            prev = self._prices.get(ticker)
            previous_price = prev.price if prev else price

            if reference_price is None:
                reference_price = prev.reference_price if prev else price

            update = PriceUpdate(
                ticker=ticker,
                price=round(price, 2),
                previous_price=round(previous_price, 2),
                timestamp=ts,
                reference_price=round(reference_price, 2) if reference_price else None,
            )
            self._prices[ticker] = update
            self._version += 1
            return update

    def get(self, ticker: str) -> PriceUpdate | None:
        """Latest price for a single ticker, or None if unknown."""
        with self._lock:
            return self._prices.get(ticker)

    def get_all(self) -> dict[str, PriceUpdate]:
        """Snapshot of all current prices (shallow copy)."""
        with self._lock:
            return dict(self._prices)

    def get_price(self, ticker: str) -> float | None:
        """Convenience: just the price float, or None."""
        update = self.get(ticker)
        return update.price if update else None

    def remove(self, ticker: str) -> None:
        """Remove a ticker (e.g. when removed from the watchlist)."""
        with self._lock:
            if self._prices.pop(ticker, None) is not None:
                self._version += 1

    @property
    def version(self) -> int:
        """Monotonic change counter, used by SSE for change detection."""
        with self._lock:
            return self._version

    def __len__(self) -> int:
        with self._lock:
            return len(self._prices)

    def __contains__(self, ticker: str) -> bool:
        with self._lock:
            return ticker in self._prices
```

### 6.3 Example sequence

```python
cache = PriceCache()
cache.update("AAPL", 190.00)                 # prev=190.00 ref=190.00 dir=flat  day=0.0
cache.update("AAPL", 190.50)                 # prev=190.00 ref=190.00 dir=up    day=0.26
cache.update("AAPL", 190.10)                 # prev=190.50 ref=190.00 dir=down  day=0.05

cache.update("MSFT", 421.0, reference_price=418.0)   # Massive-style: ref from prev close
cache.get("MSFT").day_change_percent                 # 0.72
cache.update("MSFT", 422.0)                          # ref carried over: 418.0
```

---

## 7. Unified Interface — `interface.py`

Unchanged. Repeated here because it is the contract every implementation and caller codes against.

```python
from abc import ABC, abstractmethod


class MarketDataSource(ABC):
    """Contract for market data providers.

    Implementations push price updates into a shared PriceCache on their own
    schedule. Downstream code never calls the data source directly for prices;
    it reads from the cache.
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Begin producing price updates for the given tickers. Call exactly once."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop the background task. Safe to call multiple times."""

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. No-op if already present."""

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker from the active set and from the PriceCache. No-op if absent."""

    @abstractmethod
    def get_tickers(self) -> list[str]:
        """Current list of actively tracked tickers."""
```

### Behavioral contract (both implementations must satisfy; tested in §17.4)

| Call | Simulator | Massive |
|---|---|---|
| `start(tickers)` returns | cache holds a price for every ticker | cache holds a price for every ticker the first poll returned (immediate poll inside `start`) |
| `add_ticker(t)` returns | `t` is priced in the cache | `t` is tracked; priced after the next poll (≤ `poll_interval`) |
| `remove_ticker(t)` returns | `t` is gone from cache and never reappears | same, including when a poll is in flight (G3) |
| `stop()` returns | no further cache writes | no further cache writes |
| `add_ticker` twice / `remove_ticker` unknown | no-op | no-op |

---

## 8. Seed Prices and Parameters — `seed_prices.py`

Unchanged. Summary of the values:

| Ticker | Seed | σ (vol) | μ (drift) | Group |
|---|---|---|---|---|
| AAPL | 190 | 0.22 | 0.05 | tech |
| GOOGL | 175 | 0.25 | 0.05 | tech |
| MSFT | 420 | 0.20 | 0.05 | tech |
| AMZN | 185 | 0.28 | 0.05 | tech |
| TSLA | 250 | 0.50 | 0.03 | (independent, ρ = 0.3 with all) |
| NVDA | 800 | 0.40 | 0.08 | tech |
| META | 500 | 0.30 | 0.05 | tech |
| JPM | 195 | 0.18 | 0.04 | finance |
| V | 280 | 0.17 | 0.04 | finance |
| NFLX | 600 | 0.35 | 0.05 | tech |
| *other* | U(50, 300) | 0.25 | 0.05 | none (ρ = 0.3) |

Correlations: tech–tech 0.6, finance–finance 0.5, everything else 0.3.

**Positive definiteness.** A correlation matrix built from these rules is always positive definite, so `np.linalg.cholesky` cannot fail. Each group block is `(1−ρ)I + ρJ` (eigenvalues > 0 for ρ < 1) and the off-block value 0.3 is never larger than the in-block values. The test in §17.3 checks this explicitly for the 10 defaults plus 40 unknown tickers.

To extend the seed list (for example, to give PYPL a realistic seed), add entries to `SEED_PRICES`, `TICKER_PARAMS` and, if wanted, a `CORRELATION_GROUPS` set. No other code changes.

---

## 9. GBM Simulator — `simulator.py`

### 9.1 Math

Each tick advances every price by one step of geometric Brownian motion:

```
S(t+dt) = S(t) · exp( (μ − σ²/2)·dt + σ·√dt·Z )
```

- `dt = 0.5 s / (252 days × 6.5 h × 3600 s) = 0.5 / 5,896,800 ≈ 8.48e-8` of a trading year.
- `Z` is a vector of correlated standard normals: `Z = L · ε`, with `ε ~ N(0, I)` and `L = cholesky(C)`.
- Expected per-tick move for AAPL (σ = 0.22): `σ·√dt ≈ 0.22 × 2.91e-4 ≈ 0.0064%`, about 1.2¢ on $190. Over an hour (7,200 ticks) that is `√7200 × 0.0064% ≈ 0.54%`, a realistic intraday range.
- **Events:** each tick, each ticker has probability `p = 0.001` of a shock of ±U(2%, 5%). With 10 tickers at 2 ticks/s: `10 × 2 × 0.001 = 0.02` events/s, about one every 50s.
- Prices stay positive: `exp(·) > 0`, and the worst shock multiplies by 0.95.

### 9.2 `GBMSimulator`

The class is unchanged except that it normalizes ticker input. Full code for reference:

```python
class GBMSimulator:
    """Geometric Brownian Motion simulator for correlated stock prices."""

    TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # 5,896,800
    DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR  # ~8.48e-8

    def __init__(
        self,
        tickers: list[str],
        dt: float = DEFAULT_DT,
        event_probability: float = 0.001,
    ) -> None:
        self._dt = dt
        self._event_prob = event_probability
        self._tickers: list[str] = []
        self._prices: dict[str, float] = {}
        self._params: dict[str, dict[str, float]] = {}
        self._cholesky: np.ndarray | None = None

        for ticker in tickers:
            self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def step(self) -> dict[str, float]:
        """Advance all tickers by one time step. Returns {ticker: new_price}."""
        n = len(self._tickers)
        if n == 0:
            return {}

        z_independent = np.random.standard_normal(n)
        z = self._cholesky @ z_independent if self._cholesky is not None else z_independent

        result: dict[str, float] = {}
        for i, ticker in enumerate(self._tickers):
            mu = self._params[ticker]["mu"]
            sigma = self._params[ticker]["sigma"]

            drift = (mu - 0.5 * sigma**2) * self._dt
            diffusion = sigma * math.sqrt(self._dt) * z[i]
            self._prices[ticker] *= math.exp(drift + diffusion)

            if random.random() < self._event_prob:
                shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
                self._prices[ticker] *= 1 + shock
                logger.debug("Random event on %s: %+.1f%%", ticker, shock * 100)

            result[ticker] = round(self._prices[ticker], 2)
        return result

    def add_ticker(self, ticker: str) -> None:
        if ticker in self._prices:
            return
        self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def remove_ticker(self, ticker: str) -> None:
        if ticker not in self._prices:
            return
        self._tickers.remove(ticker)
        del self._prices[ticker]
        del self._params[ticker]
        self._rebuild_cholesky()

    def get_price(self, ticker: str) -> float | None:
        return self._prices.get(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    def _add_ticker_internal(self, ticker: str) -> None:
        if ticker in self._prices:
            return
        self._tickers.append(ticker)
        self._prices[ticker] = SEED_PRICES.get(ticker, random.uniform(50.0, 300.0))
        self._params[ticker] = TICKER_PARAMS.get(ticker, dict(DEFAULT_PARAMS))

    def _rebuild_cholesky(self) -> None:
        n = len(self._tickers)
        if n <= 1:
            self._cholesky = None
            return
        corr = np.eye(n)
        for i in range(n):
            for j in range(i + 1, n):
                rho = self._pairwise_correlation(self._tickers[i], self._tickers[j])
                corr[i, j] = corr[j, i] = rho
        self._cholesky = np.linalg.cholesky(corr)

    @staticmethod
    def _pairwise_correlation(t1: str, t2: str) -> float:
        if t1 == "TSLA" or t2 == "TSLA":
            return TSLA_CORR
        tech, finance = CORRELATION_GROUPS["tech"], CORRELATION_GROUPS["finance"]
        if t1 in tech and t2 in tech:
            return INTRA_TECH_CORR
        if t1 in finance and t2 in finance:
            return INTRA_FINANCE_CORR
        return CROSS_GROUP_CORR
```

### 9.3 `SimulatorDataSource`

Changes from today: ticker normalization, and nothing else. The seed price is written as the first cache update, so it automatically becomes the `reference_price` (§6.1). That is the whole day-change implementation for the simulator.

```python
class SimulatorDataSource(MarketDataSource):
    """MarketDataSource backed by the GBM simulator."""

    def __init__(
        self,
        price_cache: PriceCache,
        update_interval: float = 0.5,
        event_probability: float = 0.001,
    ) -> None:
        self._cache = price_cache
        self._interval = update_interval
        self._event_prob = event_probability
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        tickers = [normalize_ticker(t) for t in tickers]
        self._sim = GBMSimulator(tickers=tickers, event_probability=self._event_prob)
        # Seed the cache so SSE and trades have prices immediately.
        # The first update also fixes reference_price = seed price.
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")
        logger.info("Simulator started with %d tickers", len(tickers))

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("Simulator stopped")

    async def add_ticker(self, ticker: str) -> None:
        ticker = normalize_ticker(ticker)
        if self._sim and ticker not in self._sim.get_tickers():
            self._sim.add_ticker(ticker)
            # Price immediately: PLAN §8 promises simulator tickers are tradable at once.
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
            logger.info("Simulator: added ticker %s", ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = normalize_ticker(ticker)
        if self._sim:
            self._sim.remove_ticker(ticker)
        self._cache.remove(ticker)
        logger.info("Simulator: removed ticker %s", ticker)

    def get_tickers(self) -> list[str]:
        return self._sim.get_tickers() if self._sim else []

    async def _run_loop(self) -> None:
        while True:
            try:
                if self._sim:
                    for ticker, price in self._sim.step().items():
                        self._cache.update(ticker=ticker, price=price)
            except Exception:
                logger.exception("Simulator step failed")
            await asyncio.sleep(self._interval)
```

The `ticker not in self._sim.get_tickers()` guard in `add_ticker` matters: without it, re-adding a ticker that is already tracked would write its *current* price again with `previous_price == price`, producing a spurious `"flat"` tick. `POST /api/watchlist` is idempotent (200 on repeat), so this path is reachable.

No race exists between `remove_ticker` and `_run_loop`: both run on the event loop, and `step()` plus the cache writes happen without an `await` in between.

### 9.4 Unknown tickers (PLAN item 11, simulator half)

Any well-formed symbol is accepted and seeded at U($50, $300) with default parameters. **Recommendation: accept this.** The simulator is a demo; refusing `ZZZZ` would need a symbol list we do not have, and the random seed is visibly plausible.

---

## 10. Massive API Client — `massive_client.py`

### 10.1 API facts this design depends on

Verified against the installed `massive` package (`massive/rest/models/snapshot.py`, `trades.py`, `aggs.py`):

| Fact | Detail |
|---|---|
| Endpoint | `GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=A,B,C`, via `client.get_snapshot_all(market_type=SnapshotMarketType.STOCKS, tickers=[...])`. One call for all tickers. |
| Return | `list[TickerSnapshot]`. Tickers the API does not know are simply **absent** from the list. |
| `TickerSnapshot` fields | `ticker`, `day: Agg`, `prev_day: Agg`, `min: MinuteSnapshot`, `last_trade: LastTrade`, `last_quote`, `todays_change`, `todays_change_percent`, `updated` (ns). Every field is `Optional`. |
| `LastTrade` fields | `price`, `size`, `sip_timestamp` (**ns**), `participant_timestamp`, `exchange`, … There is **no** `timestamp` attribute. |
| `Agg` fields | `open`, `high`, `low`, `close`, `volume`, `vwap`, `timestamp` (ms). There is no `previous_close`; the previous close is `prev_day.close`. |
| Errors | Non-200 → `massive.exceptions.BadResponse`; missing key → `AuthError`. 5xx and 429 get urllib3 retries inside the client (3 by default, backoff 0.1s). |
| Rate limits | Free: 5 calls/min → 15s interval uses 4/min. Paid: effectively unlimited; 2–5s is reasonable. |
| Data reset | Snapshot data is cleared at 12am ET and refills from ~4am ET. Between those times `day` and `last_trade` can be empty. |

The archived `MASSIVE_API.md` shows `day.previous_close` and millisecond `last_trade.timestamp`. Those are wrong for this client and are what caused G1.

### 10.2 Price selection from a snapshot

Prices are taken in this order, using the first one that is present and positive:

1. `last_trade.price`: the actual last print, including extended hours.
2. `min.close`: the latest minute bar.
3. `day.close`: today's running close.
4. `prev_day.close`: covers the midnight–4am window when today's data is cleared.

Timestamp, converted to Unix seconds: `last_trade.sip_timestamp / 1e9`, else `updated / 1e9`, else `time.time()`.

Reference price (day-change baseline): `prev_day.close` if present.

This logic is a module-level pure function so it can be tested against **real** `TickerSnapshot.from_dict(...)` objects (§17.2), which is the gap that let G1 through.

```python
NS_PER_SECOND = 1_000_000_000


@dataclass(frozen=True, slots=True)
class ParsedSnapshot:
    ticker: str
    price: float
    timestamp: float  # Unix seconds
    reference_price: float | None


def _positive(value: object) -> float | None:
    if isinstance(value, (int, float)) and value > 0:
        return float(value)
    return None


def parse_snapshot(snap: TickerSnapshot) -> ParsedSnapshot | None:
    """Extract price, timestamp and day-change baseline from a Massive snapshot.

    Returns None when the snapshot has no ticker or no usable price.
    """
    if not snap.ticker:
        return None

    trade, minute, day, prev_day = snap.last_trade, snap.min, snap.day, snap.prev_day
    price = (
        _positive(trade.price if trade else None)
        or _positive(minute.close if minute else None)
        or _positive(day.close if day else None)
        or _positive(prev_day.close if prev_day else None)
    )
    if price is None:
        return None

    ts_ns = (trade.sip_timestamp if trade else None) or snap.updated
    timestamp = ts_ns / NS_PER_SECOND if ts_ns else time.time()

    reference = _positive(prev_day.close if prev_day else None)
    return ParsedSnapshot(snap.ticker, price, timestamp, reference)
```

Example input (the raw JSON the client deserializes) and result:

```json
{
  "ticker": "AAPL",
  "todaysChangePerc": 0.65,
  "updated": 1791100800120000000,
  "day":      {"o": 190.4, "h": 191.9, "l": 189.8, "c": 191.2, "v": 41230000},
  "prevDay":  {"o": 188.1, "h": 190.6, "l": 187.9, "c": 190.0, "v": 52011000},
  "min":      {"c": 191.22, "t": 1791100740000},
  "lastTrade":{"p": 191.24, "s": 100, "t": 1791100800120000000, "x": 4}
}
```

```python
>>> parse_snapshot(TickerSnapshot.from_dict(raw))
ParsedSnapshot(ticker='AAPL', price=191.24, timestamp=1791100800.12, reference_price=190.0)
```

### 10.3 `MassiveDataSource`

```python
"""Massive (Polygon.io) API client for real market data."""

from __future__ import annotations

import asyncio
import logging
import time
from dataclasses import dataclass

from massive import RESTClient
from massive.rest.models import SnapshotMarketType, TickerSnapshot

from .cache import PriceCache
from .interface import MarketDataSource
from .tickers import normalize_ticker

logger = logging.getLogger(__name__)

MAX_BACKOFF_SECONDS = 300.0
MISSING_WARN_AFTER_POLLS = 3

# ... NS_PER_SECOND, ParsedSnapshot, _positive, parse_snapshot from §10.2 ...


class MassiveDataSource(MarketDataSource):
    """MarketDataSource backed by the Massive (Polygon.io) REST snapshot API.

    Polls all tracked tickers in one call every `poll_interval` seconds and writes
    the results to the PriceCache. Free tier: 5 req/min, so the default is 15s.
    """

    def __init__(
        self,
        api_key: str,
        price_cache: PriceCache,
        poll_interval: float = 15.0,
    ) -> None:
        self._api_key = api_key
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None
        self._client: RESTClient | None = None
        self._consecutive_failures = 0
        self._missing_polls: dict[str, int] = {}

    async def start(self, tickers: list[str]) -> None:
        self._client = RESTClient(api_key=self._api_key)
        self._tickers = [normalize_ticker(t) for t in tickers]
        await self._poll_once()  # Immediate first poll so the cache has data at startup
        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")
        logger.info(
            "Massive poller started: %d tickers, %.1fs interval",
            len(self._tickers),
            self._interval,
        )

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        self._client = None
        logger.info("Massive poller stopped")

    async def add_ticker(self, ticker: str) -> None:
        ticker = normalize_ticker(ticker)
        if ticker not in self._tickers:
            # Rebind rather than append: a poll thread may be iterating the old list.
            self._tickers = [*self._tickers, ticker]
            logger.info("Massive: added %s (priced on next poll)", ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = normalize_ticker(ticker)
        self._tickers = [t for t in self._tickers if t != ticker]
        self._missing_polls.pop(ticker, None)
        self._cache.remove(ticker)
        logger.info("Massive: removed %s", ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    # --- Internal ---

    def _next_delay(self) -> float:
        """Poll interval, doubled per consecutive failure, capped at 5 minutes."""
        if self._consecutive_failures == 0:
            return self._interval
        return min(self._interval * 2**self._consecutive_failures, MAX_BACKOFF_SECONDS)

    async def _poll_loop(self) -> None:
        while True:
            await asyncio.sleep(self._next_delay())
            await self._poll_once()

    async def _poll_once(self) -> None:
        requested = list(self._tickers)  # Immutable copy for the worker thread (G4)
        if not requested or not self._client:
            return

        try:
            snapshots = await asyncio.to_thread(self._fetch_snapshots, requested)
        except Exception as e:
            self._consecutive_failures += 1
            logger.error(
                "Massive poll failed (%d in a row, next try in %.0fs): %s",
                self._consecutive_failures,
                self._next_delay(),
                e,
            )
            return

        self._consecutive_failures = 0
        active = set(self._tickers)  # Re-read AFTER the await: removals may have happened (G3)
        seen: set[str] = set()

        for snap in snapshots:
            parsed = parse_snapshot(snap)
            if parsed is None:
                logger.warning("Skipping unusable snapshot for %s", snap.ticker or "???")
                continue
            if parsed.ticker not in active:
                continue  # Removed while the request was in flight
            self._cache.update(
                ticker=parsed.ticker,
                price=parsed.price,
                timestamp=parsed.timestamp,
                reference_price=parsed.reference_price,
            )
            seen.add(parsed.ticker)

        self._track_missing(requested, seen, active)
        logger.debug("Massive poll: priced %d/%d tickers", len(seen), len(requested))

    def _track_missing(self, requested: list[str], seen: set[str], active: set[str]) -> None:
        """Warn once about symbols the API never returns (likely not real tickers)."""
        for ticker in requested:
            if ticker in seen or ticker not in active:
                self._missing_polls.pop(ticker, None)
                continue
            count = self._missing_polls.get(ticker, 0) + 1
            self._missing_polls[ticker] = count
            if count == MISSING_WARN_AFTER_POLLS:
                logger.warning(
                    "Massive returned no data for %s in %d polls; it may not be a valid symbol",
                    ticker,
                    count,
                )

    def _fetch_snapshots(self, tickers: list[str]) -> list[TickerSnapshot]:
        """Synchronous REST call. Runs in a worker thread."""
        return self._client.get_snapshot_all(
            market_type=SnapshotMarketType.STOCKS,
            tickers=tickers,
        )
```

### 10.4 The removal race, step by step (G3)

```
t=0.0  _poll_once: requested = [AAPL, PYPL]; await to_thread(fetch)   ← yields to loop
t=0.1  DELETE /api/watchlist/PYPL → remove_ticker("PYPL") → cache.remove("PYPL")
t=0.4  fetch returns [AAPL snap, PYPL snap]
       old code: cache.update("PYPL", ...)   ← PYPL is back in the cache and the SSE stream
       new code: "PYPL" not in active → skipped
```

`active` is read after the `await`, so any removal that happened while the thread ran is respected. No lock is needed: the read, the filter and the writes happen on the event loop with no `await` between them.

### 10.5 Failure handling (G8)

| Failure | Behavior |
|---|---|
| Network error, 5xx | The client retries internally. If it still fails: log, back off (15s → 30s → 60s → … → 300s), keep the last cached prices. |
| 429 rate limit | Same backoff. Usually means another process shares the key. |
| 401 / 403 bad key or plan | Same backoff; the log shows the error every ≤5 min, not every 15s. The app keeps running with no prices: trades return `price_unavailable` and the watchlist shows `null`. The fix is in `.env`. |
| One malformed snapshot | Skipped with a warning; the other tickers update. |
| Unknown symbol | Absent from the response; stays unpriced; one warning after 3 polls (§10.6). |
| First poll fails at startup | `start()` still returns (the error is caught). The app starts with an empty cache. Positions are valued at cost until prices arrive (§15.3). |

### 10.6 Unknown symbols (PLAN item 11, Massive half)

**Recommendation: accept the ticker and leave it unpriced, as the API contract already implies.** Rejecting it at `POST /api/watchlist` would require a validation call (`get_snapshot_ticker`), which spends one of the free tier's 5 calls per minute on every add, and the poller already uses 4. The cost is that a typo such as `APPL` sits on the watchlist with `null` prices until the user removes it. The backend logs a warning after three polls. The frontend should show `—` for a `null` price.

### 10.7 Outside market hours (PLAN item 14)

Prices are static evenings and weekends, so in Massive mode there are no flashes, sparklines stay flat, and the SSE stream sends only heartbeats (§12). `day_change_percent` still shows the last session's move against the close before it. This is expected behavior, not a bug. Document it in the README.

---

## 11. Factory — `factory.py`

Adds `MASSIVE_POLL_INTERVAL` (PLAN §6: "Polls … on a configurable interval").

```python
"""Factory for creating market data sources."""

from __future__ import annotations

import logging
import os

from .cache import PriceCache
from .interface import MarketDataSource
from .massive_client import MassiveDataSource
from .simulator import SimulatorDataSource

logger = logging.getLogger(__name__)

DEFAULT_MASSIVE_POLL_INTERVAL = 15.0  # Free tier: 5 calls/min
MIN_MASSIVE_POLL_INTERVAL = 1.0


def _poll_interval_from_env() -> float:
    raw = os.environ.get("MASSIVE_POLL_INTERVAL", "").strip()
    if not raw:
        return DEFAULT_MASSIVE_POLL_INTERVAL
    try:
        return max(float(raw), MIN_MASSIVE_POLL_INTERVAL)
    except ValueError:
        logger.warning("Ignoring invalid MASSIVE_POLL_INTERVAL=%r", raw)
        return DEFAULT_MASSIVE_POLL_INTERVAL


def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Return an unstarted source: Massive if MASSIVE_API_KEY is set, else the simulator."""
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        interval = _poll_interval_from_env()
        logger.info("Market data source: Massive API (poll every %.1fs)", interval)
        return MassiveDataSource(api_key=api_key, price_cache=price_cache, poll_interval=interval)

    logger.info("Market data source: GBM simulator")
    return SimulatorDataSource(price_cache=price_cache)
```

`massive` stays a core dependency imported at module level (the archived review chose this, so simulator-only installs still need the package; it is small and pure Python).

---

## 12. SSE Streaming — `stream.py`

### 12.1 Wire format

```
retry: 1000

data: {"AAPL": {"ticker": "AAPL", "price": 191.24, "previous_price": 191.10, "timestamp": 1791100800.12, "change": 0.14, "change_percent": 0.0733, "direction": "up", "reference_price": 190.0, "day_change_percent": 0.65}, "MSFT": {...}}

data: {...}

: keep-alive

data: {...}
```

- `retry: 1000` first, as now (PLAN §8).
- One unnamed `data:` event whenever `cache.version` changed since the last send, checked every 500ms. Each event carries **every** ticker in the cache, so a client that missed events is fully up to date after the next one, and a ticker missing from an event has been removed.
- New: a `: keep-alive` comment line after 15s with no data (G7). `EventSource` ignores comment lines; they keep proxies and load balancers from closing an idle connection.
- New fields `reference_price` and `day_change_percent` (§5). Everything else is byte-identical to today.

### 12.2 Code

The router is now created **inside** the factory (G6), so each call returns an independent router.

```python
"""SSE streaming endpoint for live price updates."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from collections.abc import AsyncGenerator
from typing import Protocol

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from .cache import PriceCache

logger = logging.getLogger(__name__)

SSE_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",  # Disable nginx buffering if proxied
}


class _DisconnectAware(Protocol):
    async def is_disconnected(self) -> bool: ...


def create_stream_router(
    price_cache: PriceCache,
    interval: float = 0.5,
    heartbeat: float = 15.0,
) -> APIRouter:
    """Create a fresh SSE router bound to the given price cache."""
    router = APIRouter(prefix="/api/stream", tags=["streaming"])

    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        return StreamingResponse(
            generate_events(price_cache, request, interval=interval, heartbeat=heartbeat),
            media_type="text/event-stream",
            headers=SSE_HEADERS,
        )

    return router


async def generate_events(
    price_cache: PriceCache,
    request: _DisconnectAware,
    interval: float = 0.5,
    heartbeat: float = 15.0,
) -> AsyncGenerator[str, None]:
    """Yield SSE frames until the client disconnects."""
    yield "retry: 1000\n\n"

    last_version = -1
    last_sent = time.monotonic()
    try:
        while not await request.is_disconnected():
            version = price_cache.version
            if version != last_version:
                last_version = version
                prices = price_cache.get_all()
                payload = json.dumps({t: u.to_dict() for t, u in prices.items()})
                yield f"data: {payload}\n\n"
                last_sent = time.monotonic()
            elif time.monotonic() - last_sent >= heartbeat:
                yield ": keep-alive\n\n"
                last_sent = time.monotonic()
            await asyncio.sleep(interval)
    except asyncio.CancelledError:
        pass
    logger.debug("SSE stream closed")
```

Two behavior changes to note:

- An event with an **empty** object (`data: {}`) is now sent when the last ticker is removed. Before, nothing was sent, so the frontend kept showing the removed ticker. The frontend treats the event as the full set.
- The generator is renamed from `_generate_events` to `generate_events` because tests call it directly (§17.5). The request parameter is typed as a small protocol so a test can pass a fake.

### 12.3 Frontend consumption (for reference)

```ts
const es = new EventSource("/api/stream/prices");
es.onmessage = (e) => {
  const snapshot: Record<string, PriceTick> = JSON.parse(e.data);
  // Full set: replace, don't merge — a missing ticker was removed.
  setPrices(snapshot);
};
// Connection dot: es.readyState  OPEN=1 → green, CONNECTING=0 → yellow, CLOSED=2 → red
```

---

## 13. Package Exports — `__init__.py`

```python
"""Market data subsystem for FinAlly."""

from .cache import PriceCache
from .factory import create_market_data_source
from .interface import MarketDataSource
from .models import PriceUpdate
from .stream import create_stream_router
from .tickers import InvalidTicker, normalize_ticker

__all__ = [
    "InvalidTicker",
    "MarketDataSource",
    "PriceCache",
    "PriceUpdate",
    "create_market_data_source",
    "create_stream_router",
    "normalize_ticker",
]
```

---

## 14. FastAPI Integration (Lifespan and Dependencies)

PLAN item 8: the database and the market data source are both needed at startup, so both are initialized in the lifespan, in this order:

1. Initialize the database (create tables, seed if empty).
2. Read the watchlist tickers.
3. Start the market data source with them. After `start()` returns, the simulator has priced every ticker; Massive has done its first poll.
4. Record the startup portfolio snapshot (needs prices from step 3).
5. On shutdown, stop the source.

The `PriceCache` is created in `create_app()` (not in the lifespan) because the stream router needs it when routes are registered, which happens before the lifespan runs.

```python
# backend/app/main.py  (sketch; db and portfolio module names are up to the backend agent)
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request

from app.market import MarketDataSource, PriceCache, create_market_data_source, create_stream_router


def create_app() -> FastAPI:
    price_cache = PriceCache()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        db.init_db()                                      # 1
        tickers = db.watchlist.list_tickers()             # 2
        source = create_market_data_source(price_cache)
        await source.start(tickers)                       # 3
        app.state.market_source = source
        portfolio.record_snapshot(price_cache)            # 4
        try:
            yield
        finally:
            await source.stop()                           # 5

    app = FastAPI(lifespan=lifespan)
    app.state.price_cache = price_cache

    app.include_router(create_stream_router(price_cache))
    # app.include_router(watchlist_router), portfolio_router, chat_router, health_router ...
    # Static mount LAST so /api/* wins (PLAN item 31)
    return app


app = create_app()


# Dependencies for route handlers
def get_price_cache(request: Request) -> PriceCache:
    return request.app.state.price_cache


def get_market_source(request: Request) -> MarketDataSource:
    return request.app.state.market_source
```

Because the app is built by a factory, tests can create a fresh app per test with no shared state. G6 had made that unsafe.

---

## 15. How Other Modules Use Market Data

These are the only touchpoints between market data and the rest of the backend. The code shows the market-data side; error and DB helpers (`ApiError`, `db.*`) belong to the backend agent.

### 15.1 Watchlist add / remove

```python
async def add_to_watchlist(raw_ticker: str, cache: PriceCache, source: MarketDataSource):
    ticker = normalize_ticker(raw_ticker)           # InvalidTicker → invalid_ticker 400
    row, created = db.watchlist.insert_if_absent(ticker)
    await source.add_ticker(ticker)                 # No-op if already tracked
    return watchlist_entry(row.ticker, row.added_at, cache), (201 if created else 200)


async def remove_from_watchlist(raw_ticker: str, source: MarketDataSource) -> None:
    ticker = normalize_ticker(raw_ticker)
    async with portfolio_lock:                      # Same lock as trades (PLAN item 19)
        if not db.watchlist.exists(ticker):
            raise ApiError("not_watched", 404, f"{ticker} is not on your watchlist.")
        if db.positions.quantity(ticker) > 0:
            raise ApiError("position_open", 409, f"Sell your {ticker} position before removing it.")
        db.watchlist.delete(ticker)
    await source.remove_ticker(ticker)              # Also removes it from the cache
```

- **Order on add:** DB first, then the source. If the source call were first and the DB insert failed, the source would track a ticker that is not on the watchlist.
- **Order on remove:** check, delete from the DB, then the source, all after the position check. The check and the delete run under the same lock as trade execution, so a chat-initiated buy cannot open a position between the check and the delete.
- `add_ticker` is safe to call for a ticker that is already on the watchlist (idempotent `POST`): the source ignores it (§9.3).

### 15.2 Watchlist entry (`GET /api/watchlist`, `POST /api/watchlist` response)

```python
def watchlist_entry(ticker: str, added_at: str, cache: PriceCache) -> dict:
    u = cache.get(ticker)
    return {
        "ticker": ticker,
        "price": u.price if u else None,
        "previous_price": u.previous_price if u else None,
        "direction": u.direction if u else None,
        "day_change_percent": u.day_change_percent if u else None,
        "added_at": added_at,
    }
```

### 15.3 Trade fill price and portfolio valuation

```python
def fill_price(ticker: str, cache: PriceCache) -> float:
    """Trade rule 2: the cached price at the moment of execution."""
    price = cache.get_price(ticker)
    if price is None:
        raise ApiError("price_unavailable", 409, f"No live price for {ticker} yet. Try again shortly.")
    return price


def mark_price(ticker: str, avg_cost: float, cache: PriceCache) -> float:
    """Valuation price for a held position. Falls back to cost if unpriced."""
    price = cache.get_price(ticker)
    return price if price is not None else avg_cost
```

Trade rule order (PLAN §8) is: watched → priced → cash/shares. So `fill_price` is called after the watchlist check and before the cash check, inside `portfolio_lock`, with no `await` between reading the price and writing the trade.

`mark_price` falls back to cost so that `GET /api/portfolio` and the startup snapshot never fail. A held ticker is always on the watchlist (the 409 rule), so the fallback only applies in Massive mode before the first successful poll.

### 15.4 Error mapping

```python
@app.exception_handler(InvalidTicker)
async def invalid_ticker_handler(request: Request, exc: InvalidTicker):
    return JSONResponse(
        status_code=400,
        content={"error": {"code": "invalid_ticker", "message": str(exc)}},
    )
```

### 15.5 Chat context

The chat prompt builder reads `cache.get_all()` once and formats each watched ticker as `TICKER price (day ±x.xx%)`. It does not call the source.

---

## 16. Optional: Server-Side Price History (PLAN item 13)

**Not part of the baseline.** PLAN item 13 is still open: today price history lives only in the browser, so a refresh empties the main chart and the sparklines. If the decision is to keep history on the server, this is the smallest design that works.

```python
# backend/app/market/history.py
from collections import deque
from threading import Lock


class PriceHistory:
    """Rolling per-ticker (timestamp, price) buffer. ~10 min at 0.5s ticks."""

    def __init__(self, maxlen: int = 1200) -> None:
        self._maxlen = maxlen
        self._data: dict[str, deque[tuple[float, float]]] = {}
        self._lock = Lock()

    def append(self, ticker: str, timestamp: float, price: float) -> None:
        with self._lock:
            self._data.setdefault(ticker, deque(maxlen=self._maxlen)).append((timestamp, price))

    def get(self, ticker: str) -> list[tuple[float, float]]:
        with self._lock:
            return list(self._data.get(ticker, ()))

    def remove(self, ticker: str) -> None:
        with self._lock:
            self._data.pop(ticker, None)
```

- `PriceCache` takes an optional `history: PriceHistory | None` and calls `history.append` inside `update` and `history.remove` inside `remove`.
- Memory: 50 tickers × 1,200 points × ~72 bytes ≈ 4.3 MB.
- New endpoint (requires a PLAN §8 contract entry): `GET /api/prices/history` → `{"AAPL": [[1791100800.12, 191.24], ...], ...}`. The frontend calls it once on load to pre-fill charts, then appends from SSE.

If item 13 is decided as "browser-only is fine", skip this section entirely.

---

## 17. Testing

Existing: 73 tests in `backend/tests/market/`. Run with `uv run --extra dev pytest`.

### 17.1 New: `test_tickers.py`

```python
import pytest

from app.market.tickers import InvalidTicker, normalize_ticker


@pytest.mark.parametrize(
    "raw, expected",
    [("aapl", "AAPL"), ("  MSFT ", "MSFT"), ("brk.b", "BRK.B"), ("V", "V"), ("A1234567.9", "A1234567.9")],
)
def test_normalize_valid(raw, expected):
    assert normalize_ticker(raw) == expected


@pytest.mark.parametrize("raw", ["", "   ", "1ABC", ".A", "AAPL$", "ABCDEFGHIJK", "AA PL", None, 5])
def test_normalize_invalid(raw):
    with pytest.raises(InvalidTicker):
        normalize_ticker(raw)
```

### 17.2 New: Massive parsing against **real** model objects (G1 regression)

The existing `_make_snapshot` helper builds `MagicMock` objects, which return a value for any attribute, including `last_trade.timestamp`, which does not exist on the real model. Replace it with `TickerSnapshot.from_dict`, using the JSON shape the API actually returns.

```python
from massive.rest.models import TickerSnapshot

from app.market.massive_client import parse_snapshot


def _snap(**overrides) -> TickerSnapshot:
    raw = {
        "ticker": "AAPL",
        "updated": 1791100800120000000,
        "day": {"c": 191.2},
        "prevDay": {"c": 190.0},
        "min": {"c": 191.22},
        "lastTrade": {"p": 191.24, "t": 1791100800120000000},
    }
    raw.update(overrides)
    return TickerSnapshot.from_dict(raw)


def test_parse_full_snapshot():
    p = parse_snapshot(_snap())
    assert (p.ticker, p.price, p.reference_price) == ("AAPL", 191.24, 190.0)
    assert p.timestamp == pytest.approx(1791100800.12)  # ns → s


def test_price_fallback_chain():
    assert parse_snapshot(_snap(lastTrade={})).price == 191.22          # min.close
    assert parse_snapshot(_snap(lastTrade={}, min={})).price == 191.2   # day.close
    assert parse_snapshot(_snap(lastTrade={}, min={}, day={})).price == 190.0  # prev_day.close


def test_no_price_returns_none():
    assert parse_snapshot(_snap(lastTrade={}, min={}, day={}, prevDay={})) is None


def test_timestamp_falls_back_to_updated():
    p = parse_snapshot(_snap(lastTrade={"p": 191.24}))
    assert p.timestamp == pytest.approx(1791100800.12)
```

### 17.3 New: Massive source behavior

```python
from unittest.mock import patch

from app.market.cache import PriceCache
from app.market.massive_client import MassiveDataSource


async def test_removed_ticker_not_rewritten_by_inflight_poll():
    cache = PriceCache()
    src = MassiveDataSource("key", cache)
    src._client = object()  # Non-None so _poll_once runs
    src._tickers = ["AAPL", "PYPL"]

    def fetch(tickers):
        # Simulates the removal landing while the HTTP call is in flight
        src._tickers = ["AAPL"]
        return [_snap(ticker="AAPL"), _snap(ticker="PYPL")]

    with patch.object(src, "_fetch_snapshots", side_effect=fetch):
        await src._poll_once()

    assert "AAPL" in cache
    assert "PYPL" not in cache


async def test_backoff_doubles_and_resets():
    src = MassiveDataSource("key", PriceCache(), poll_interval=15.0)
    src._client = object()
    src._tickers = ["AAPL"]
    with patch.object(src, "_fetch_snapshots", side_effect=RuntimeError("429")):
        await src._poll_once()
        await src._poll_once()
    assert src._next_delay() == 60.0
    with patch.object(src, "_fetch_snapshots", return_value=[_snap()]):
        await src._poll_once()
    assert src._next_delay() == 15.0


async def test_reference_price_from_prev_close():
    cache = PriceCache()
    src = MassiveDataSource("key", cache)
    src._client = object()
    src._tickers = ["AAPL"]
    with patch.object(src, "_fetch_snapshots", return_value=[_snap()]):
        await src._poll_once()
    assert cache.get("AAPL").day_change_percent == 0.65
```

### 17.4 New: cache, simulator and interface contract

```python
def test_reference_price_defaults_to_first_price_and_carries_over():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.update("AAPL", 191.9)
    assert cache.get("AAPL").reference_price == 190.0
    assert cache.get("AAPL").day_change_percent == 1.0


def test_zero_timestamp_is_kept():
    cache = PriceCache()
    assert cache.update("AAPL", 1.0, timestamp=0.0).timestamp == 0.0


def test_remove_bumps_version():
    cache = PriceCache()
    cache.update("AAPL", 1.0)
    v = cache.version
    cache.remove("AAPL")
    assert cache.version == v + 1


def test_cholesky_succeeds_for_defaults_plus_unknowns():
    tickers = list(SEED_PRICES) + [f"X{i}" for i in range(40)]
    sim = GBMSimulator(tickers)
    assert len(sim.step()) == 50


async def test_simulator_readd_does_not_emit_flat_tick():
    cache = PriceCache()
    src = SimulatorDataSource(cache, update_interval=10)
    await src.start(["AAPL"])
    v = cache.version
    await src.add_ticker("aapl")  # normalized, already tracked
    assert cache.version == v
    await src.stop()
```

### 17.5 New: SSE generator

Testing through an ASGI client is awkward because the stream never ends. Instead, drive `generate_events` directly with a fake request that disconnects after N checks.

```python
from app.market.stream import create_stream_router, generate_events


class FakeRequest:
    def __init__(self, checks: int) -> None:
        self._checks = checks

    async def is_disconnected(self) -> bool:
        self._checks -= 1
        return self._checks < 0


async def _collect(cache, checks, **kw):
    return [f async for f in generate_events(cache, FakeRequest(checks), interval=0, **kw)]


async def test_first_frame_is_retry_then_data():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    frames = await _collect(cache, checks=1)
    assert frames[0] == "retry: 1000\n\n"
    body = json.loads(frames[1].removeprefix("data: "))
    assert body["AAPL"]["day_change_percent"] == 0.0


async def test_no_duplicate_event_without_change():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    frames = await _collect(cache, checks=3, heartbeat=3600)
    assert sum(f.startswith("data:") for f in frames) == 1


async def test_heartbeat_when_idle():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    frames = await _collect(cache, checks=3, heartbeat=0)
    assert ": keep-alive\n\n" in frames


async def test_removal_sends_empty_snapshot():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.remove("AAPL")
    frames = await _collect(cache, checks=1)
    assert frames[1] == "data: {}\n\n"


def test_router_factory_is_independent():
    a = create_stream_router(PriceCache())
    b = create_stream_router(PriceCache())
    assert len(a.routes) == 1 and len(b.routes) == 1
```

### 17.6 Existing tests to update

| File | Change |
|---|---|
| `test_massive.py` | Replace the `MagicMock` snapshot helper with `TickerSnapshot.from_dict` (§17.2). `test_timestamp_conversion` asserts nanoseconds → seconds. `_fetch_snapshots` now takes the ticker list as an argument. |
| `test_models.py` | Add `day_change_percent` and the `to_dict()` keys. |
| `test_factory.py` | Add `MASSIVE_POLL_INTERVAL` cases: unset → 15, `"5"` → 5, `"0.1"` → 1, `"abc"` → 15. |

### 17.7 Manual check against the live API (optional, needs a key)

```bash
cd backend
MASSIVE_API_KEY=... uv run python -c "
import asyncio
from app.market import PriceCache, create_market_data_source
async def main():
    c = PriceCache(); s = create_market_data_source(c)
    await s.start(['AAPL', 'MSFT', 'ZZZZQ'])
    for t, u in c.get_all().items(): print(t, u.price, u.day_change_percent)
    await s.stop()
asyncio.run(main())"
```

Expected: AAPL and MSFT printed with prices; ZZZZQ absent. Before the G1 fix, this prints nothing.

---

## 18. Edge Cases and Failure Modes

| Case | Behavior |
|---|---|
| Empty watchlist at startup | Simulator: `step()` returns `{}`; SSE sends only `retry` + heartbeats. Massive: `_poll_once` returns without a call. |
| Ticker added in simulator mode | Priced before `add_ticker` returns; tradable immediately. |
| Ticker added in Massive mode | `null` prices and `price_unavailable` on trade until the next poll (≤ interval). |
| Ticker removed during a Massive poll | Dropped from the results (G3). |
| Re-adding a watched ticker | No-op in the source; no spurious flat tick. |
| Trade while the cache has no price | `price_unavailable` 409. |
| Portfolio valuation with no price | Position valued at `avg_cost` (§15.3). |
| Massive bad key | Logged with backoff; app runs unpriced. |
| Massive midnight–4am ET | Price falls back to `prev_day.close`. |
| Market closed (Massive) | Static prices, heartbeats only (§10.7). |
| Simulator step raises (should not happen) | Logged; loop continues next tick. |
| Client disconnects from SSE | Generator exits on the next `is_disconnected()` check (≤ 500ms) or on cancellation. |
| Many SSE clients | Each holds a 500ms polling loop and serializes the snapshot once per change. Fine for single-user; could share one serialized payload per version if it ever matters. |
| Price precision | Cache rounds to 2 decimals. Simulator keeps full precision internally, so rounding does not accumulate. |

---

## 19. Configuration

| Setting | Source | Default | Notes |
|---|---|---|---|
| `MASSIVE_API_KEY` | env | empty | Non-empty → Massive; else simulator. |
| `MASSIVE_POLL_INTERVAL` | env (new) | `15` | Seconds; minimum 1. Free tier needs ≥ 12. Add to `.env.example`. |
| Simulator tick | `SimulatorDataSource(update_interval=)` | `0.5` s | |
| Event probability | `SimulatorDataSource(event_probability=)` | `0.001` | Per ticker per tick. |
| SSE cadence | `create_stream_router(interval=)` | `0.5` s | |
| SSE heartbeat | `create_stream_router(heartbeat=)` | `15` s | |
| SSE client retry | hard-coded frame | `1000` ms | PLAN §8. |
| Massive backoff cap | `MAX_BACKOFF_SECONDS` | `300` s | |
| Unknown-symbol warning | `MISSING_WARN_AFTER_POLLS` | `3` | |

---

## 20. Decisions to Write Back into PLAN.md

PLAN §13.3 asks owning agents to record their decisions there. Proposed text:

| PLAN item | Proposed decision |
|---|---|
| 11 — ticker validation on add | Accept any symbol matching the format. Simulator seeds unknown symbols at U($50, $300). Massive mode does not pre-validate (it would cost rate-limited calls); a non-existent symbol stays unpriced, and the backend logs a warning after 3 polls. |
| 12 — day change baseline | `day_change_percent` is measured against `reference_price`: the previous close (`prev_day.close`) in Massive mode, the seed price (first price seen since start) in simulator mode. Rounded to 2 decimals. The SSE ticker object gains `reference_price` and `day_change_percent`. |
| 13 — main chart history | Open. §16 gives a design if a server buffer is wanted. |
| 14 — Massive outside market hours | Expected behavior: static prices, no flashes, heartbeats only. Documented in the README. |
| §6 — Massive poll interval | Configurable via `MASSIVE_POLL_INTERVAL` (seconds, default 15). |
| §8 SSE | Adds `reference_price` and `day_change_percent` per ticker, `: keep-alive` comments after 15s idle, and an empty `{}` event when the last ticker is removed. |

---

## 21. Implementation Checklist

In order; each step keeps the test suite green.

1. Add `tickers.py` and `test_tickers.py`. Export from `__init__.py`.
2. `models.py`: add `reference_price` and `day_change_percent`; extend `to_dict()`. Update `test_models.py`.
3. `cache.py`: `reference_price` handling, `timestamp is None`, `remove()` bumps the version, `version` under the lock. Add the cache tests from §17.4.
4. `simulator.py`: normalize in `start` / `add_ticker` / `remove_ticker`; add the already-tracked guard in `add_ticker`. Add the simulator tests from §17.4.
5. `massive_client.py`: `parse_snapshot` (G1), ticker list copy (G4), post-await filter (G3), backoff (G8), missing-symbol warning. Rewrite the `test_massive.py` helpers on `TickerSnapshot.from_dict`; add §17.2 and §17.3.
6. `factory.py`: `MASSIVE_POLL_INTERVAL`. Extend `test_factory.py`.
7. `stream.py`: router inside the factory (G6), heartbeat (G7), rename to `generate_events`. Add `test_stream.py` (§17.5).
8. Run `uv run --extra dev pytest` and `uv run --extra dev ruff check app/ tests/`.
9. If a key is available, run the live check in §17.7.
10. Update `backend/CLAUDE.md` (new exports, env var), `MARKET_DATA_SUMMARY.md`, and write the §20 decisions into PLAN.md §13.
