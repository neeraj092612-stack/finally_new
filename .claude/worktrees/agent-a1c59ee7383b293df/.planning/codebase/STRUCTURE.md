---
last_mapped_commit: ab8faa811f2fa60fcadbd0de3c6af2005521e5ce
last_mapped_at: 2026-10-19
---
<!-- refreshed: 2026-10-19 -->

# Codebase Structure

**Analysis Date:** 2026-10-19

## Directory Layout

```
finally_new/                         # Repository root
├── .claude/                       # Claude/GSD tooling (excluded from analysis)
├── .github/workflows/             # claude.yml, claude-code-review.yml
├── backend/                       # FastAPI uv project (Python 3.12)
│   ├── app/                       # Application package
│   │   ├── __init__.py            # Package marker only
│   │   └── market/                # Market data subsystem (IMPLEMENTED)
│   ├── tests/                     # pytest suite
│   │   ├── conftest.py
│   │   └── market/                # Tests for app/market
│   ├── market_data_demo.py        # Rich terminal demo of the simulator
│   ├── pyproject.toml             # uv/hatch project definition
│   ├── uv.lock                    # Locked dependencies
│   ├── CLAUDE.md                  # Backend developer guide
│   └── README.md
├── planning/                      # Project-wide docs (agent shared contract)
│   ├── PLAN.md                    # Full specification
│   ├── MARKET_DATA_DESIGN.md
│   ├── MARKET_DATA_SUMMARY.md
│   ├── Review.md
│   └── archive/                   # Superseded market data design docs
├── db/                            # Local SQLite location (empty; finally.db gitignored)
├── independent-reviewer/
│   └── hooks/hooks.json           # Reviewer hook configuration
├── .planning/codebase/            # Generated codebase maps (this directory)
├── CLAUDE.md                      # Root project instructions
├── README.md
├── LICENSE
└── .gitignore
```

Not present yet, but specified in `planning/PLAN.md` §4: `frontend/`, `scripts/`, `test/`, `Dockerfile`, `.env.example`, `backend/db/`.

## Directory Purposes

**`backend/app/`:**
- Purpose: Python application package.
- Contains: `__init__.py` and the `market/` subpackage. No `main.py`, `routers/`, `services/`, or `models/` yet.
- Key files: `backend/app/__init__.py`

**`backend/app/market/`:**
- Purpose: market data producers, cache, and SSE transport.
- Contains: `interface.py`, `models.py`, `cache.py`, `factory.py`, `simulator.py`, `seed_prices.py`, `massive_client.py`, `stream.py`, `__init__.py`.
- Key files: `backend/app/market/interface.py`, `backend/app/market/cache.py`, `backend/app/market/factory.py`, `backend/app/market/stream.py`

**`backend/tests/`:**
- Purpose: pytest tests, mirroring the package layout.
- Contains: `conftest.py`, `market/test_cache.py`, `market/test_factory.py`, `market/test_massive.py`, `market/test_models.py`, `market/test_simulator.py`, `market/test_simulator_source.py`.
- Key files: `backend/tests/conftest.py`

**`backend/` (root files):**
- `pyproject.toml`: project metadata, dependencies (`fastapi`, `uvicorn[standard]`, `numpy`, `massive`, `rich`), `dev` extras (`pytest`, `pytest-asyncio`, `pytest-cov`, `ruff`), pytest and ruff config.
- `uv.lock`: lockfile; keep in sync with `pyproject.toml`.
- `market_data_demo.py`: standalone demo script.

**`planning/`:**
- Purpose: shared agent documentation. `PLAN.md` is authoritative for scope and API contracts.
- Contains: current design and summary docs for the market data work; `archive/` holds superseded versions.

**`db/`:**
- Purpose: location of `finally.db` when the backend runs outside Docker (PLAN §4). Only the directory exists.

**`independent-reviewer/`:**
- Purpose: reviewer tooling hooks. Not part of the application runtime.

**`.github/workflows/`:**
- Purpose: GitHub Actions for Claude PR assistant and code review.

## Key File Locations

**Entry Points:**
- `backend/app/market/__init__.py`: public import surface for market data.
- `backend/market_data_demo.py`: runnable demo.
- Application entry point (`backend/app/main.py`): missing.

**Configuration:**
- `backend/pyproject.toml`: Python project, lint, and test settings.
- `backend/app/market/seed_prices.py`: default ticker seed prices and per-ticker volatility/drift.
- `.env` (root, gitignored): runtime secrets and mode switches; not present in the reviewed tree and must never be read into docs.

**Core Logic:**
- `backend/app/market/simulator.py`: GBM engine and simulator data source.
- `backend/app/market/massive_client.py`: Massive REST polling source.
- `backend/app/market/cache.py`: shared price cache.
- `backend/app/market/stream.py`: SSE endpoint.

**Testing:**
- `backend/tests/market/`: unit tests for the market subsystem.
- `backend/tests/conftest.py`: shared pytest fixtures.
- `test/` (root, E2E Playwright): not yet present.

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `massive_client.py`, `simulator.py`).
- Tests: `test_<module>.py` under `backend/tests/<subpackage>/` (e.g., `backend/tests/market/test_cache.py`).
- Planning docs: `UPPERCASE.md` (e.g., `PLAN.md`, `MARKET_DATA_DESIGN.md`).
- Codebase maps: `UPPERCASE.md` under `.planning/codebase/`.

**Directories:**
- Python packages: lowercase, single word (`app`, `market`, `tests`).
- Test directories mirror source packages (`tests/market` ↔ `app/market`).

**Code identifiers (observed):**
- Classes: `PascalCase` (`PriceCache`, `SimulatorDataSource`, `MassiveDataSource`).
- Factory functions: `create_*` (`create_market_data_source`, `create_stream_router`).
- Private helpers: leading underscore (`_run_loop`, `_poll_once`, `_generate_events`).
- Module logger: `logger = logging.getLogger(__name__)`.

## Where to Add New Code

**New backend API route group (e.g., portfolio, watchlist, chat):**
- Primary code: `backend/app/<feature>/` as a package, or `backend/app/routers/<feature>.py` if the team chooses a layered layout. Follow the factory pattern used by `create_stream_router` and keep routers free of module-level globals.
- Tests: `backend/tests/<feature>/test_<module>.py`.

**Database schema and seed logic:**
- Schema and seed: `backend/db/` (per PLAN §4; create this directory with schema SQL and seed code).
- Database path: `db/finally.db` locally, `/app/db/finally.db` in Docker (PLAN §4, §11).

**New market data provider:**
- Implementation: `backend/app/market/<provider>.py`, subclassing `MarketDataSource` from `backend/app/market/interface.py`.
- Register in: `backend/app/market/factory.py`.
- Tests: `backend/tests/market/test_<provider>.py`.

**New shared utility or model used across the backend:**
- Place under `backend/app/` in a small module; export publicly from a package `__init__.py` only when other packages depend on it.

**Application wiring (lifespan, app creation, static mount):**
- `backend/app/main.py` (to be created): create `PriceCache`, call `create_market_data_source`, mount `create_stream_router(cache)` and API routers, mount the frontend build at `/`.

**Frontend (when created):**
- `frontend/` is a self-contained Next.js TypeScript project with static export (`output: 'export'`), per PLAN §4. It must not import Python code and talks only to `/api/*`.

**E2E tests (when created):**
- `test/` with Playwright specs and `docker-compose.test.yml` (PLAN §4, §12).

**Scripts (when created):**
- `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_windows.ps1` (PLAN §4, §11).

## Special Directories

**`.planning/codebase/`:**
- Purpose: generated codebase analysis documents consumed by GSD planning commands.
- Generated: Yes.
- Committed: Yes (project decision; confirm in `.gitignore` if changed).

**`planning/archive/`:**
- Purpose: superseded market data design documents kept for reference.
- Generated: No.
- Committed: Yes.

**`backend/.venv/`, `.pytest_cache/`, `.ruff_cache/`, `__pycache__/`:**
- Purpose: tool caches and virtualenv.
- Generated: Yes.
- Committed: No (gitignored).

**`db/*.db`:**
- Purpose: local SQLite database file.
- Generated: Yes at runtime.
- Committed: No (gitignored).

---

*Structure analysis: 2026-10-19*
