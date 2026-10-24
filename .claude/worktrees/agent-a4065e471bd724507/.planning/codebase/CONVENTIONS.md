---
last_mapped_commit: ab8faa811f2fa60fcadbd0de3c6af2005521e5ce
last_mapped_at: 2026-10-19
---
# Coding Conventions

**Analysis Date:** 2026-10-19

## Scope of the Current Codebase

Only the backend market data subsystem exists in code today: `backend/app/market/`, plus a demo script `backend/market_data_demo.py`. The frontend (`frontend/`), the database layer, portfolio, watchlist, chat and the FastAPI app entry point are not yet implemented. The conventions below are what is observed in the market code and must be carried forward. Where the plan (`planning/PLAN.md`) prescribes something not yet built, it is labelled as such.

## Languages and Tooling

- Python 3.12+ (`backend/pyproject.toml`: `requires-python = ">=3.12"`, ruff `target-version = "py312"`).
- Package manager: `uv` (`backend/uv.lock` present). Build backend: hatchling, wheel packages = `["app"]`.
- Lint: ruff, configured in `backend/pyproject.toml` under `[tool.ruff]`:
  - `line-length = 100`
  - `select = ["E", "F", "I", "N", "W"]` (pycodestyle, pyflakes, isort, pep8-naming, pycodestyle warnings)
  - `ignore = ["E501"]` (long lines are tolerated; the formatter handles them)
- Run: `uv run --extra dev ruff check app/ tests/` (from `backend/`, documented in `backend/CLAUDE.md`).
- No formatter (black/ruff format) config is committed; the code is formatted in a black-like style with double quotes, trailing commas and 4-space indents. Keep that style.
- Frontend tooling (Next.js, TypeScript, Tailwind) is specified in `planning/PLAN.md` Section 10 but is not yet present; no ESLint/Prettier config exists.

## Naming Patterns

**Files:**
- `snake_case.py` for all modules: `cache.py`, `massive_client.py`, `seed_prices.py`, `market_data_demo.py`.
- Test files mirror source with `test_` prefix: `tests/market/test_cache.py` tests `app/market/cache.py`.

**Classes:**
- `PascalCase`. Abstract base is named for its role: `MarketDataSource` (`app/market/interface.py`). Concrete implementations are named `<Variant><Role>`: `SimulatorDataSource`, `MassiveDataSource`, `GBMSimulator` (pure math engine, wrapped by `SimulatorDataSource`).
- Dataclasses use `@dataclass(frozen=True, slots=True)` for value objects (`PriceUpdate` in `app/market/models.py`).

**Functions and methods:**
- `snake_case`. Verbs for commands (`start`, `stop`, `add_ticker`, `remove_ticker`, `step`), nouns/`get_` for accessors (`get_price`, `get_all`, `get_tickers`).
- Private helpers are prefixed with a single underscore: `_poll_once`, `_fetch_snapshots`, `_add_ticker_internal`, `_rebuild_cholesky`, `_pairwise_correlation` (static method).
- Async methods are used for lifecycle and source operations (`async def start`, `async def add_ticker`). Pure read accessors are sync (`get_tickers`).

**Variables and constants:**
- Module-level constants `UPPER_SNAKE_CASE`: `SEED_PRICES`, `TICKER_PARAMS`, `DEFAULT_PARAMS`, `CORRELATION_GROUPS`, `INTRA_TECH_CORR`, `SPARK_CHARS`, `TICKERS`.
- Class-level constants also `UPPER_SNAKE_CASE`: `GBMSimulator.TRADING_SECONDS_PER_YEAR`, `GBMSimulator.DEFAULT_DT`.
- Logger is always the module-level `logger = logging.getLogger(__name__)`.

**Tickers:**
- Stored as uppercase strings, e.g. `"AAPL"`. Note: `MassiveDataSource.add_ticker` and `remove_ticker` normalize with `.upper().strip()`, but `SimulatorDataSource` and `PriceCache` do not normalize. Normalization is a responsibility of the caller/API layer (PLAN.md Section 8: tickers are trimmed, uppercased and validated against `^[A-Z][A-Z0-9.]{0,9}$`). New code should normalize at the boundary, not inside the cache.

## Type Annotations

- Every module starts with `from __future__ import annotations` (see `app/market/*.py`). Use PEP 604 unions (`float | None`, `PriceUpdate | None`) and builtin generics (`dict[str, float]`, `list[str]`).
- Public functions and methods are fully annotated, including return types (`-> PriceUpdate`, `-> None`).
- Use `from collections.abc import AsyncGenerator` for generator return types (`app/market/stream.py`).
- Typing-only imports are not guarded with `TYPE_CHECKING` in the current code; do not introduce `TYPE_CHECKING` blocks unless needed.

## Module Structure and Docstrings

- Every module has a one-line module docstring: `"""Thread-safe in-memory price cache."""`.
- Every class and public method has a docstring. Style is short imperative or descriptive sentences; `Args`/`Returns` sections are not used. Math-heavy code includes a `Math:` block (`GBMSimulator` class docstring).
- Lifecycle contracts are documented in the docstring of the ABC (`MarketDataSource` shows a usage example in its class docstring).
- Hot-path or non-obvious decisions are commented inline with a reason, e.g. `# Massive timestamps are Unix milliseconds → convert to seconds`, `# The Massive RESTClient is synchronous — run in a thread to avoid blocking the event loop.`

## Package Exports

- Public API of a subpackage is re-exported from `__init__.py` with an explicit `__all__`. Example: `backend/app/market/__init__.py` exports `PriceUpdate`, `PriceCache`, `MarketDataSource`, `create_market_data_source`, `create_stream_router`.
- Internal modules import siblings with relative imports: `from .cache import PriceCache`, `from .models import PriceUpdate`.
- Other packages (including tests and the demo) import from the package root: `from app.market import PriceCache`. Tests sometimes import the submodule directly (`from app.market.simulator import GBMSimulator`) when they need internals; that is acceptable in tests.
- The `app/__init__.py` file is a one-line docstring only. Keep it that way; do not add barrel re-exports at `app/` level.

## Import Organization

Observed order (enforced by ruff `I`):
1. `from __future__ import annotations`
2. Standard library (`asyncio`, `logging`, `os`, `time`, `threading.Lock`)
3. Third-party (`fastapi`, `numpy`, `massive`, `rich`)
4. Local relative imports (`from .cache import ...`)

Blank line between groups. No path aliases exist (Python).

## Data and Immutability

- Value objects are frozen dataclasses with derived values as `@property` rather than stored fields (`PriceUpdate.change`, `change_percent`, `direction`). Follow this pattern for derived portfolio values too.
- Serialization is an explicit `to_dict()` method returning plain JSON-compatible types; do not rely on `dataclasses.asdict` for API output.
- Monetary and price values are `float`, rounded at the boundary: prices to 2 decimals in `PriceCache.update` (`round(price, 2)`), change to 4 decimals in properties. Keep money as plain JSON numbers at the API layer (PLAN.md Section 8).
- Snapshots of shared state are returned as copies: `PriceCache.get_all()` returns `dict(self._prices)`.

## Concurrency

- Shared mutable state guarded by `threading.Lock` (`PriceCache._lock`). Every method that touches `_prices` or `_version` takes the lock with a `with self._lock:` block.
- Background work is an `asyncio.Task` created with a name: `asyncio.create_task(self._run_loop(), name="simulator-loop")`, `name="massive-poller"`.
- Stopping a task: cancel, then `await` inside `try/except asyncio.CancelledError: pass`. Guard with `if self._task and not self._task.done()` and set `self._task = None`. `stop()` must be idempotent.
- Blocking I/O inside async code is pushed to a thread with `await asyncio.to_thread(...)`.

## Error Handling

**Pattern: log and continue in background loops.** Long-running loops never let an exception escape:

```python

# app/market/simulator.py

async def _run_loop(self) -> None:
    while True:
        try:
            ...
        except Exception:
            logger.exception("Simulator step failed")
        await asyncio.sleep(self._interval)
```

```python

# app/market/massive_client.py

except Exception as e:
    logger.error("Massive poll failed: %s", e)
    # Don't re-raise — the loop will retry on the next interval.
```

**Pattern: per-item tolerance.** When processing a batch, skip malformed items and log a warning:

```python
except (AttributeError, TypeError) as e:
    logger.warning("Skipping snapshot for %s: %s", getattr(snap, "ticker", "???"), e)
```

**Pattern: safe defaults for degenerate math.** `PriceUpdate.change_percent` returns `0.0` when `previous_price == 0` instead of raising `ZeroDivisionError`.

**Pattern: no-op idempotency.** Add/remove operations are no-ops on duplicates or unknown tickers (`GBMSimulator.add_ticker`, `remove_ticker`, `PriceCache.remove`). Do not raise for these.

**Pattern: raise only for programmer errors.** No custom exception classes exist yet. For the API layer, PLAN.md Section 8 mandates a single error body: `{"error": {"code": "...", "message": "..."}}` with codes such as `insufficient_cash` (400), `ticker_not_watched` (400), `price_unavailable` (409), `llm_error` (502). Implement these via a FastAPI exception handler that replaces the default `{"detail": ...}` shape; do not return `HTTPException(detail=...)` directly.

## Logging

- Framework: standard library `logging`. No `print()` in `app/` (the demo script uses Rich for output).
- Always `logger = logging.getLogger(__name__)` at module top.
- Use lazy %-style arguments, not f-strings: `logger.info("Simulator: added ticker %s", ticker)`.
- Levels: `info` for lifecycle events (start/stop, add/remove ticker, client connect/disconnect), `debug` for per-tick detail (random events in `simulator.py`, per-poll counts), `warning` for skipped data, `error` for failed external calls, `exception` (with traceback) for unexpected failures inside loops.
- Hot per-tick paths must not log at `info` (the simulator steps every 500ms).

## Comments and Docstrings

- Comment the *why* (rationale, rate limits, threading constraints), not the *what*.
- Section dividers inside classes use `# --- Public API ---`, `# --- Internal ---`, `# --- Internals ---` (`simulator.py`, `massive_client.py`). Use the same divider style for new classes with distinct public/private halves.
- Constants are documented with an inline comment on the same line or above (`# 500ms expressed as a fraction of a trading year`).

## Function Design

- Keep public methods small; the hot simulator loop (`GBMSimulator.step`) is the exception and is documented as such.
- Default arguments for tunables: `update_interval: float = 0.5`, `poll_interval: float = 15.0`, `event_probability: float = 0.001`. Tests override these with short intervals (`update_interval=0.05`) and long ones (`poll_interval=60.0`) to control timing.
- Dependencies are injected via constructor, not globals: `SimulatorDataSource(price_cache=cache)`, `create_stream_router(price_cache)`. Avoid module-level singletons for new state; the PLAN.md requires a single `PriceCache` instance shared by the app.
- Factory functions read environment variables and return an unstarted object (`create_market_data_source` in `app/market/factory.py`). Env var checks use `os.environ.get("NAME", "").strip()` so whitespace-only values count as unset.

## Configuration

- Environment-driven: `MASSIVE_API_KEY` selects the data source (`app/market/factory.py`). Per PLAN.md Section 5, `OPENROUTER_API_KEY` and `LLM_MOCK` are also environment variables.
- The `.env` file is read by Docker (`--env-file`); the code reads `os.environ` only. Do not load `.env` contents into source, tests or docs.
- Seed data and per-ticker parameters are plain Python dicts in `app/market/seed_prices.py` (`SEED_PRICES`, `TICKER_PARAMS`, `DEFAULT_PARAMS`, correlation constants). Add new tickers there.

## Module Design

- One concept per module: `cache.py` (store), `models.py` (value types), `interface.py` (ABC), `simulator.py` and `massive_client.py` (implementations), `factory.py` (selection), `stream.py` (HTTP adapter), `seed_prices.py` (data).
- Every `MarketDataSource` implementation must provide `start`, `stop`, `add_ticker`, `remove_ticker`, `get_tickers`, and must write only to the shared `PriceCache`. Downstream code reads prices from the cache, never from a source directly.
- Inside `stream.py`, `router` is a module-level `APIRouter` and `create_stream_router` attaches the route to it. Be aware this means calling the factory twice registers the route twice on the same router object. New routers should construct their `APIRouter` inside a factory function (or per-module once) and not mutate a shared module-level router.

## Patterns to Follow for New Code (Backend)

- Use FastAPI routers with a `prefix` and `tags` (`APIRouter(prefix="/api/stream", tags=["streaming"])`).
- Use `StreamingResponse` with `media_type="text/event-stream"` for SSE; send `retry: 1000` first.
- Keep the price cache as the single source of current prices; portfolio valuation and trade execution read `PriceCache.get_price(ticker)`.
- Money math (cash, avg cost, P&L) should live in plain functions or a service class that accepts the cache and DB as arguments, so it can be unit tested without FastAPI.

## Frontend Conventions (Specified, Not Yet Implemented)

From PLAN.md Section 10 and Section 2:
- TypeScript with Next.js static export (`output: 'export'`); Tailwind CSS with a custom dark theme (backgrounds around `#0d1117` / `#1a1a2e`).
- Palette: accent yellow `#ecad0a`, blue primary `#209dd7`, purple secondary `#753991` (submit buttons).
- Use native `EventSource` for `/api/stream/prices`; all API calls use same-origin `/api/*`.
- Only Lightweight Charts for canvas charts; sparklines are hand-rolled SVG; heatmap is a custom CSS/SVG treemap. Do not add a second charting library.
- Price flash: apply a CSS class for ~500ms with a background transition, then remove it.

## Git and Repository Hygiene

- `.gitignore` excludes `.env`, `.env.*` (except `.env.example`), `__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `db/*.db*`, and Playwright output directories.
- `backend/app/market/__pycache__/` exists in the working tree; it must stay untracked.

---

*Convention analysis: 2026-10-19*
