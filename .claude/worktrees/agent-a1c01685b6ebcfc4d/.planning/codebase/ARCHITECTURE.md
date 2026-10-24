---
last_mapped_commit: ab8faa811f2fa60fcadbd0de3c6af2005521e5ce
last_mapped_at: 2026-10-19
---
<!-- refreshed: 2026-10-19 -->

# Architecture

**Analysis Date:** 2026-10-19

## Current State

The repository is early in its build. Only the market data subsystem is implemented, in `backend/app/market/`. The planned pieces are specified in `planning/PLAN.md` but do not yet exist in the repo:

- No FastAPI application entry point (no `backend/app/main.py`), so the market SSE router is not yet mounted anywhere.
- No `frontend/` directory, no Dockerfile, no `scripts/`, no `test/` (Playwright) directory.
- No SQLite layer: no `backend/db/`, no schema, no portfolio, watchlist, trade, or chat modules.
- No LLM integration.
- `db/` exists at the root but contains only an empty directory (no `.gitkeep` tracked yet).

Architecture statements below describe the implemented market data layer and the target architecture from `planning/PLAN.md` where it is labelled as such.

## System Overview

```text
┌──────────────────────────────────────────────────────────────┐
│  Target: Single container, port 8000 (planning/PLAN.md §3)   │
│                                                              │
│  FastAPI app  (backend/app/main.py — NOT YET IMPLEMENTED)    │
│  ├── /api/stream/*  ──► market SSE router  [IMPLEMENTED]     │
│  ├── /api/*         ──► portfolio/watchlist/chat [PLANNED]   │
│  └── /*             ──► Next.js static export [PLANNED]      │
│                                                              │
│  Market data subsystem  [IMPLEMENTED]                        │
│  MarketDataSource (ABC)                                      │
│   ├── SimulatorDataSource  → GBMSimulator                    │
│   └── MassiveDataSource    → Massive REST snapshot polling   │
│            │ writes                                          │
│            ▼                                                 │
│        PriceCache (in-memory, versioned)                     │
│            │ reads                                           │
│            ▼                                                 │
│        SSE generator  → EventSource clients                  │
└──────────────────────────────────────────────────────────────┘
```

## Pattern Overview

**Overall:** Layered service with a producer/cache/consumer split for market data, and a factory-selected strategy for the data source.

**Key Characteristics:**
- Producers (simulator or Massive poller) run as in-process `asyncio` background tasks and push into a shared cache. They never talk to HTTP clients.
- Consumers (SSE streams) only read from the cache. Downstream code is agnostic of the price source (`backend/app/market/interface.py` docstring).
- Dependencies are injected by factory functions (`create_stream_router(price_cache)`, `create_market_data_source(price_cache)`) rather than module-level singletons. The cache instance is the only shared object passed around.
- Data is in-memory only for prices; no database is involved in the market path.
- Single-user model today. The PLAN specifies a `user_id = "default"` constant for future multi-user support, but nothing in the implemented code depends on it.

## Layers

**Domain models (value objects):**
- Purpose: immutable price snapshot and derived fields.
- Location: `backend/app/market/models.py`
- Contains: `PriceUpdate` frozen dataclass with `change`, `change_percent`, `direction`, `to_dict()`.
- Depends on: stdlib only.
- Used by: `cache.py`, `simulator.py`, `massive_client.py`, `stream.py`.

**Shared state (cache):**
- Purpose: thread-safe latest-price store with a monotonic `version` counter used for change detection.
- Location: `backend/app/market/cache.py` (class `PriceCache`)
- Contains: `update()`, `get()`, `get_price()`, `get_all()`, `remove()`, `version`, `__len__`, `__contains__`.
- Depends on: `models.PriceUpdate`.
- Used by: all producers and the SSE generator.

**Provider interface:**
- Purpose: contract every price source must satisfy.
- Location: `backend/app/market/interface.py` (ABC `MarketDataSource`)
- Lifecycle: `start(tickers)` → `add_ticker` / `remove_ticker` → `stop()`; `get_tickers()` reports the active set.
- Depends on: nothing in the package.
- Used by: `factory.py` return type; the future app lifespan will call it.

**Provider implementations:**
- `backend/app/market/simulator.py`:
  - `GBMSimulator` (pure math, geometric Brownian motion with a Cholesky-factored correlation matrix and occasional jump "events") and `SimulatorDataSource` (wraps it in an asyncio loop at 0.5 s).
  - Seeds prices from `backend/app/market/seed_prices.py`.
- `backend/app/market/massive_client.py`:
  - `MassiveDataSource` polls the Massive REST snapshot endpoint for the union of tickers on a fixed interval. The synchronous SDK call runs via `asyncio.to_thread` in `_fetch_snapshots`.
  - Timestamps from Massive (ms) are converted to seconds before writing to the cache.

**Selection (factory):**
- Purpose: choose a provider from environment.
- Location: `backend/app/market/factory.py` (`create_market_data_source`)
- Rule: non-empty `MASSIVE_API_KEY` → `MassiveDataSource`; otherwise `SimulatorDataSource`.

**Transport (SSE):**
- Purpose: push cache snapshots to browsers.
- Location: `backend/app/market/stream.py`
- Contains: `create_stream_router(price_cache)` returns an `APIRouter` with `GET /api/stream/prices`; `_generate_events()` async generator.

**Package facade:**
- Location: `backend/app/market/__init__.py` re-exports `PriceUpdate`, `PriceCache`, `MarketDataSource`, `create_market_data_source`, `create_stream_router`.

## Data Flow

### Price Update Path (simulator)

1. `SimulatorDataSource._run_loop()` calls `GBMSimulator.step()` every 0.5 s (`backend/app/market/simulator.py`).
2. Each ticker's new price is written with `PriceCache.update()`, which bumps `version` (`backend/app/market/cache.py`).
3. Seeding: `start()` and `add_ticker()` write an initial price immediately so the ticker is priced without waiting for a tick.

### Price Update Path (Massive)

1. `MassiveDataSource._poll_loop()` sleeps for its interval, then `_poll_once()` (`backend/app/market/massive_client.py`).
2. `_fetch_snapshots()` runs in a worker thread; results are written to the cache with `last_trade.price` and `last_trade.timestamp / 1000`.
3. Per-snapshot errors are logged and skipped; poll-level errors are logged and retried on the next interval.

### SSE Delivery Path

1. Client opens `GET /api/stream/prices` (`stream.py`, `stream_prices`).
2. `_generate_events()` first yields `retry: 1000`, then loops every 0.5 s:
   - checks `request.is_disconnected()` and exits when true;
   - if `price_cache.version` changed since last send, serializes `get_all()` into one JSON object keyed by ticker and yields `data: {...}\n\n`.
3. Cancellation (`asyncio.CancelledError`) is caught and logged.

**State Management:**
- Prices: process-local dict inside `PriceCache`, guarded by a lock; lost on restart.
- Tickers: held by the source (`GBMSimulator._tickers` or `MassiveDataSource._tickers`); not persisted.
- Client state: none on the server; each SSE connection keeps only `last_version`.

## Key Abstractions

**`MarketDataSource`:**
- Purpose: swap simulator and real data without touching consumers.
- Examples: `backend/app/market/simulator.py` (`SimulatorDataSource`), `backend/app/market/massive_client.py` (`MassiveDataSource`).
- Pattern: abstract base class with factory selection.

**`PriceCache`:**
- Purpose: single source of truth for latest prices; the handoff point between producers and consumers.
- Examples: `backend/app/market/cache.py`.
- Pattern: versioned shared store; consumers poll `version` rather than receiving callbacks.

**`PriceUpdate`:**
- Purpose: wire-compatible price record (`to_dict()` is used directly by SSE).
- Examples: `backend/app/market/models.py`.
- Pattern: frozen dataclass with derived properties.

**`GBMSimulator`:**
- Purpose: pure, testable price-path generator independent of asyncio.
- Examples: `backend/app/market/simulator.py`.
- Pattern: stateful stepper; `step()` returns `dict[str, float]`.

## Entry Points

**Market SSE router (implemented, not yet mounted):**
- Location: `backend/app/market/stream.py` (`create_stream_router`).
- Triggers: HTTP `GET /api/stream/prices`.
- Responsibilities: stream all cached prices at ~500 ms when the version changes.

**Market demo (developer tool):**
- Location: `backend/market_data_demo.py`.
- Triggers: `uv run market_data_demo.py` from `backend/`.
- Responsibilities: runs the simulator and renders a live terminal dashboard via `rich`.

**Planned application entry point:**
- Location: `backend/app/main.py` (does not exist yet).
- Expected responsibilities per PLAN §8 and §3: FastAPI lifespan that initializes the database, creates `PriceCache`, calls `create_market_data_source(cache)` and `start()` with the watchlist, mounts `create_stream_router(cache)` and the `/api` routers, and serves the Next.js export at `/`.

## Architectural Constraints

- **Threading:** Single asyncio event loop for the server. The only thread use is `asyncio.to_thread` for the blocking Massive SDK call. `PriceCache` is lock-protected because it is touched from that worker thread indirectly through the snapshot path and from the loop.
- **Global state:** `backend/app/market/stream.py` defines a module-level `router = APIRouter(...)`, and `create_stream_router()` attaches its endpoint to that shared object on every call. Calling the factory twice (e.g., in tests) registers duplicate `/api/stream/prices` routes on the same router. Create it once per app.
- **Circular imports:** None detected. The dependency direction is `models` ← `cache` ← `{simulator, massive_client, stream}` ← `factory` ← `__init__`.
- **Simulator tickers:** `SimulatorDataSource.add_ticker` is a no-op until `start()` has created the internal `GBMSimulator`, so tickers added before start are silently dropped. Start must precede add.
- **Seed-time coupling:** `SimulatorDataSource.start()` seeds the cache from the tickers passed in; the watchlist must be known at start time or added later.
- **Massive poll cadence:** The free tier allows ~5 calls/min, so the polling interval is a hard external constraint (PLAN §6).

## Anti-Patterns

### Module-level router with factory-attached routes

**What happens:** `create_stream_router` decorates `router.get("/prices")` inside the factory, mutating a module-global `router` (`backend/app/market/stream.py`, lines 17 and 26).
**Why it's wrong:** Repeated calls accumulate duplicate routes and share state across app instances; the factory's "no globals" docstring is not accurate.
**Do this instead:** Create the `APIRouter` inside `create_stream_router()` and remove the module-level `router`, so each call returns an independent router.

### Silent no-op on ticker add before start

**What happens:** `SimulatorDataSource.add_ticker()` returns silently when `self._sim` is `None` (`backend/app/market/simulator.py`, `add_ticker`).
**Why it's wrong:** A watchlist addition made during startup races the lifespan and disappears without an error, which later surfaces as `price_unavailable` on trade.
**Do this instead:** Ensure the lifespan calls `start()` before any API route can add tickers, or raise if not started.

## Error Handling

**Strategy:** Log and continue in background loops; never let a producer crash the process.

**Patterns:**
- `SimulatorDataSource._run_loop` wraps each `step()` in `try/except Exception` and logs with `logger.exception`.
- `MassiveDataSource._poll_once` catches per-snapshot `AttributeError`/`TypeError` (skip) and any poll failure (log, retry next interval).
- SSE generator treats client disconnect and cancellation as normal exit.
- The planned API error envelope (`{"error": {"code", "message"}}`, PLAN §8) is not implemented yet.

## Cross-Cutting Concerns

**Logging:** Standard library `logging` with module-level `logger = logging.getLogger(__name__)`; `market_data_demo.py` uses `rich`.
**Validation:** Not yet implemented for API inputs. Ticker format rules (`^[A-Z][A-Z0-9.]{0,9}$`) are specified in PLAN §8 but not present in code.
**Authentication:** None, by design (PLAN §2). `MASSIVE_API_KEY` and `OPENROUTER_API_KEY` are read from the environment.
**Configuration:** Environment variables read directly with `os.environ` in `backend/app/market/factory.py`. No settings module exists yet.

---

*Architecture analysis: 2026-10-19*
