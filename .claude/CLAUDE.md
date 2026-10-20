<!-- GSD:project-start source:PROJECT.md -->

## Project

**FinAlly — AI Trading Workstation**

FinAlly (Finance Ally) is a single-user, browser-based AI trading workstation that streams live market prices, lets the user trade a simulated $10,000 portfolio, and includes an LLM chat assistant that analyzes positions and executes trades and watchlist changes on the user's behalf. It looks and feels like a dark, data-dense Bloomberg-style terminal with an AI copilot. It is the capstone project for an agentic AI coding course and is built entirely by coding agents; the full specification is `planning/PLAN.md`, which this project implements exactly.

**Core Value:** The live demo must work and impress from one Docker command: prices stream and flash, manual trades fill instantly, and the AI chat executes trades through natural language. When tradeoffs arise, the end-to-end demo experience wins over breadth or polish elsewhere.

### Constraints

- **Tech stack**: FastAPI + uv (Python 3.12), SQLite, Next.js static export with TypeScript + Tailwind, Lightweight Charts, LiteLLM — fixed by PLAN.md
- **Deployment**: single Docker container on port 8000, named volume `finally-data` at `/app/db` — one-command student experience
- **Realtime**: SSE only, native `EventSource` — one-way push, no WebSockets
- **LLM**: `openrouter/openai/gpt-oss-120b` via OpenRouter with Cerebras provider, `OPENROUTER_API_KEY` from root `.env` — course requirement
- **Visual**: dark theme (~`#0d1117`), accent `#ecad0a`, blue `#209dd7`, purple `#753991` submit buttons; desktop-first
- **Contracts**: API shapes, error codes, and trade-rule order in PLAN.md §8 are binding

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- Python 3.12+ - All implemented backend code in `backend/app/` and tests in `backend/tests/` (`requires-python = ">=3.12"` in `backend/pyproject.toml`)
- TypeScript - Planned for the frontend (`frontend/`, currently empty); not yet present in the repo
- Bash / PowerShell - Planned start/stop scripts in `scripts/` (directory currently empty)

## Runtime

- CPython 3.12 (minimum), per `backend/pyproject.toml` and `backend/uv.lock`
- Node 20 (planned, for the frontend static build stage of the Dockerfile; not yet present)
- Python 3.12 slim base image (planned, for the runtime Docker stage per `planning/PLAN.md`)
- `uv` (Python project and lockfile manager)
- Lockfile: present - `backend/uv.lock`
- No `.python-version` or `.nvmrc` file detected

## Frameworks

- FastAPI `0.128.7` (locked) - HTTP API and SSE routing; `backend/app/market/stream.py` uses `APIRouter`, `Request`, and `StreamingResponse`
- Uvicorn `0.40.0` (locked, with `standard` extras) - ASGI server; planned to run the app on port 8000
- Next.js with TypeScript and Tailwind CSS (planned) - Frontend, built as a static export (`output: 'export'`); not yet present in the repo
- pytest `9.0.2` (locked, dev group) - Test runner; configured under `[tool.pytest.ini_options]` in `backend/pyproject.toml` (`testpaths = ["tests"]`, `asyncio_mode = "auto"`)
- pytest-asyncio `1.3.0` (locked, dev group) - Async test support
- pytest-cov (dev group) - Coverage, configured under `[tool.coverage.*]` (`source = ["app"]`)
- Playwright (planned E2E) - Present only as installed packages under `test/node_modules/` (`@playwright/test`, `playwright`, `typescript`); E2E tests not yet written
- React Testing Library or similar (planned frontend unit tests) - Not yet present
- hatchling - Build backend for the `backend` package (`[build-system]` in `backend/pyproject.toml`; wheel packages = `["app"]`)
- ruff `0.15.0` (locked, dev group) - Linting and formatting; config in `[tool.ruff]` (line-length 100, target py312, rules E, F, I, N, W; E501 ignored)
- Docker (planned) - Multi-stage build (Node 20 slim, then Python 3.12 slim) per `planning/PLAN.md`; no Dockerfile committed yet

## Key Dependencies

- `fastapi>=0.115.0` (locked 0.128.7) - Web framework and API/SSE routing
- `uvicorn[standard]>=0.32.0` (locked 0.40.0) - ASGI server
- `numpy>=2.0.0` (locked 2.4.2) - Used by `backend/app/market/simulator.py` for correlated Gaussian draws (`np.random.standard_normal`) and Cholesky decomposition of the correlation matrix (`np.linalg.cholesky`)
- `massive>=1.0.0` (locked 2.2.0) - Official Massive (Polygon.io) Python client; `backend/app/market/massive_client.py` imports `RESTClient` and `SnapshotMarketType`
- `rich>=13.0.0` (locked 14.3.2) - Terminal output, used by `backend/market_data_demo.py` for the live demo display
- `litellm` (planned, not yet declared) - LLM gateway to OpenRouter for chat, per `planning/PLAN.md` section 9
- `sqlite3` (Python standard library, planned) - Database at `db/finally.db`; no code using it exists yet
- `pytest>=8.3.0`, `pytest-asyncio>=0.24.0`, `pytest-cov>=5.0.0`, `ruff>=0.7.0`
- `hatchling` (build-system requirement)

## Configuration

- Runtime configuration is read from environment variables. Only `MASSIVE_API_KEY` is read in code today, in `backend/app/market/factory.py` (`os.environ.get("MASSIVE_API_KEY", "").strip()`). The selection rule is: non-empty key selects `MassiveDataSource`, otherwise `SimulatorDataSource`.
- Variables documented in `README.md` and `planning/PLAN.md` but not yet read by code: `OPENROUTER_API_KEY` (required for chat), `LLM_MOCK` (`true` for deterministic mock LLM responses).
- `.env` file present in the project root (contains environment configuration; contents intentionally not read). It is gitignored (`.env`, `.env.*`, with `!.env.example` exception in `.gitignore`). `.env.example` is specified but not yet created.
- Planned database path: `db/finally.db` for local runs; `/app/db/finally.db` inside Docker (named volume `finally-data`). A `DB_PATH` variable is recommended but not yet defined (see `planning/PLAN.md` section 13.2, item 32).
- `backend/pyproject.toml` - Project metadata, dependencies, build system, ruff, pytest, and coverage config
- `backend/uv.lock` - Locked dependency versions
- `.gitignore` - Ignores `.env*`, `node_modules/`, `frontend/.next/`, `frontend/out/`, `.venv/`, `__pycache__/`, `db/*.db*`, Playwright output directories

## CI Configuration

- `.github/workflows/claude.yml` - Runs `anthropics/claude-code-action@v1` on `ubuntu-latest` for `@claude` mentions; not a build or test pipeline
- `.github/workflows/claude-code-review.yml` - Claude Code review workflow; no test or build pipeline detected

## Platform Requirements

- Python 3.12+ and `uv` for the backend (`cd backend && uv sync --dev`)
- Node 20 for the frontend (planned)
- Docker for the single-container deployment (planned)
- Working environment is Windows 11 (Git Bash and PowerShell per `planning/PLAN.md` start-script spec)
- Single Docker container, port 8000, FastAPI serving the API and the static Next.js export (planned)
- SQLite file in a Docker named volume `finally-data` mounted at `/app/db`

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Scope of the Current Codebase

## Languages and Tooling

- Python 3.12+ (`backend/pyproject.toml`: `requires-python = ">=3.12"`, ruff `target-version = "py312"`).
- Package manager: `uv` (`backend/uv.lock` present). Build backend: hatchling, wheel packages = `["app"]`.
- Lint: ruff, configured in `backend/pyproject.toml` under `[tool.ruff]`:
- Run: `uv run --extra dev ruff check app/ tests/` (from `backend/`, documented in `backend/CLAUDE.md`).
- No formatter (black/ruff format) config is committed; the code is formatted in a black-like style with double quotes, trailing commas and 4-space indents. Keep that style.
- Frontend tooling (Next.js, TypeScript, Tailwind) is specified in `planning/PLAN.md` Section 10 but is not yet present; no ESLint/Prettier config exists.

## Naming Patterns

- `snake_case.py` for all modules: `cache.py`, `massive_client.py`, `seed_prices.py`, `market_data_demo.py`.
- Test files mirror source with `test_` prefix: `tests/market/test_cache.py` tests `app/market/cache.py`.
- `PascalCase`. Abstract base is named for its role: `MarketDataSource` (`app/market/interface.py`). Concrete implementations are named `<Variant><Role>`: `SimulatorDataSource`, `MassiveDataSource`, `GBMSimulator` (pure math engine, wrapped by `SimulatorDataSource`).
- Dataclasses use `@dataclass(frozen=True, slots=True)` for value objects (`PriceUpdate` in `app/market/models.py`).
- `snake_case`. Verbs for commands (`start`, `stop`, `add_ticker`, `remove_ticker`, `step`), nouns/`get_` for accessors (`get_price`, `get_all`, `get_tickers`).
- Private helpers are prefixed with a single underscore: `_poll_once`, `_fetch_snapshots`, `_add_ticker_internal`, `_rebuild_cholesky`, `_pairwise_correlation` (static method).
- Async methods are used for lifecycle and source operations (`async def start`, `async def add_ticker`). Pure read accessors are sync (`get_tickers`).
- Module-level constants `UPPER_SNAKE_CASE`: `SEED_PRICES`, `TICKER_PARAMS`, `DEFAULT_PARAMS`, `CORRELATION_GROUPS`, `INTRA_TECH_CORR`, `SPARK_CHARS`, `TICKERS`.
- Class-level constants also `UPPER_SNAKE_CASE`: `GBMSimulator.TRADING_SECONDS_PER_YEAR`, `GBMSimulator.DEFAULT_DT`.
- Logger is always the module-level `logger = logging.getLogger(__name__)`.
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

- TypeScript with Next.js static export (`output: 'export'`); Tailwind CSS with a custom dark theme (backgrounds around `#0d1117` / `#1a1a2e`).
- Palette: accent yellow `#ecad0a`, blue primary `#209dd7`, purple secondary `#753991` (submit buttons).
- Use native `EventSource` for `/api/stream/prices`; all API calls use same-origin `/api/*`.
- Only Lightweight Charts for canvas charts; sparklines are hand-rolled SVG; heatmap is a custom CSS/SVG treemap. Do not add a second charting library.
- Price flash: apply a CSS class for ~500ms with a background transition, then remove it.

## Git and Repository Hygiene

- `.gitignore` excludes `.env`, `.env.*` (except `.env.example`), `__pycache__/`, `.venv/`, `.pytest_cache/`, `.ruff_cache/`, `db/*.db*`, and Playwright output directories.
- `backend/app/market/__pycache__/` exists in the working tree; it must stay untracked.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## Current State

- No FastAPI application entry point (no `backend/app/main.py`), so the market SSE router is not yet mounted anywhere.
- No `frontend/` directory, no Dockerfile, no `scripts/`, no `test/` (Playwright) directory.
- No SQLite layer: no `backend/db/`, no schema, no portfolio, watchlist, trade, or chat modules.
- No LLM integration.
- `db/` exists at the root but contains only an empty directory (no `.gitkeep` tracked yet).

## System Overview

```text

```

## Pattern Overview

- Producers (simulator or Massive poller) run as in-process `asyncio` background tasks and push into a shared cache. They never talk to HTTP clients.
- Consumers (SSE streams) only read from the cache. Downstream code is agnostic of the price source (`backend/app/market/interface.py` docstring).
- Dependencies are injected by factory functions (`create_stream_router(price_cache)`, `create_market_data_source(price_cache)`) rather than module-level singletons. The cache instance is the only shared object passed around.
- Data is in-memory only for prices; no database is involved in the market path.
- Single-user model today. The PLAN specifies a `user_id = "default"` constant for future multi-user support, but nothing in the implemented code depends on it.

## Layers

- Purpose: immutable price snapshot and derived fields.
- Location: `backend/app/market/models.py`
- Contains: `PriceUpdate` frozen dataclass with `change`, `change_percent`, `direction`, `to_dict()`.
- Depends on: stdlib only.
- Used by: `cache.py`, `simulator.py`, `massive_client.py`, `stream.py`.
- Purpose: thread-safe latest-price store with a monotonic `version` counter used for change detection.
- Location: `backend/app/market/cache.py` (class `PriceCache`)
- Contains: `update()`, `get()`, `get_price()`, `get_all()`, `remove()`, `version`, `__len__`, `__contains__`.
- Depends on: `models.PriceUpdate`.
- Used by: all producers and the SSE generator.
- Purpose: contract every price source must satisfy.
- Location: `backend/app/market/interface.py` (ABC `MarketDataSource`)
- Lifecycle: `start(tickers)` → `add_ticker` / `remove_ticker` → `stop()`; `get_tickers()` reports the active set.
- Depends on: nothing in the package.
- Used by: `factory.py` return type; the future app lifespan will call it.
- `backend/app/market/simulator.py`:
- `backend/app/market/massive_client.py`:
- Purpose: choose a provider from environment.
- Location: `backend/app/market/factory.py` (`create_market_data_source`)
- Rule: non-empty `MASSIVE_API_KEY` → `MassiveDataSource`; otherwise `SimulatorDataSource`.
- Purpose: push cache snapshots to browsers.
- Location: `backend/app/market/stream.py`
- Contains: `create_stream_router(price_cache)` returns an `APIRouter` with `GET /api/stream/prices`; `_generate_events()` async generator.
- Location: `backend/app/market/__init__.py` re-exports `PriceUpdate`, `PriceCache`, `MarketDataSource`, `create_market_data_source`, `create_stream_router`.

## Data Flow

### Price Update Path (simulator)

### Price Update Path (Massive)

### SSE Delivery Path

- Prices: process-local dict inside `PriceCache`, guarded by a lock; lost on restart.
- Tickers: held by the source (`GBMSimulator._tickers` or `MassiveDataSource._tickers`); not persisted.
- Client state: none on the server; each SSE connection keeps only `last_version`.

## Key Abstractions

- Purpose: swap simulator and real data without touching consumers.
- Examples: `backend/app/market/simulator.py` (`SimulatorDataSource`), `backend/app/market/massive_client.py` (`MassiveDataSource`).
- Pattern: abstract base class with factory selection.
- Purpose: single source of truth for latest prices; the handoff point between producers and consumers.
- Examples: `backend/app/market/cache.py`.
- Pattern: versioned shared store; consumers poll `version` rather than receiving callbacks.
- Purpose: wire-compatible price record (`to_dict()` is used directly by SSE).
- Examples: `backend/app/market/models.py`.
- Pattern: frozen dataclass with derived properties.
- Purpose: pure, testable price-path generator independent of asyncio.
- Examples: `backend/app/market/simulator.py`.
- Pattern: stateful stepper; `step()` returns `dict[str, float]`.

## Entry Points

- Location: `backend/app/market/stream.py` (`create_stream_router`).
- Triggers: HTTP `GET /api/stream/prices`.
- Responsibilities: stream all cached prices at ~500 ms when the version changes.
- Location: `backend/market_data_demo.py`.
- Triggers: `uv run market_data_demo.py` from `backend/`.
- Responsibilities: runs the simulator and renders a live terminal dashboard via `rich`.
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

### Silent no-op on ticker add before start

## Error Handling

- `SimulatorDataSource._run_loop` wraps each `step()` in `try/except Exception` and logs with `logger.exception`.
- `MassiveDataSource._poll_once` catches per-snapshot `AttributeError`/`TypeError` (skip) and any poll failure (log, retry next interval).
- SSE generator treats client disconnect and cancellation as normal exit.
- The planned API error envelope (`{"error": {"code", "message"}}`, PLAN §8) is not implemented yet.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
