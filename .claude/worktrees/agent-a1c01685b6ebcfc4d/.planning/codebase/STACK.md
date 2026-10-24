---
last_mapped_commit: ab8faa811f2fa60fcadbd0de3c6af2005521e5ce
last_mapped_at: 2026-10-19
---
# Technology Stack

**Analysis Date:** 2026-10-19

## Languages

**Primary:**
- Python 3.12+ - All implemented backend code in `backend/app/` and tests in `backend/tests/` (`requires-python = ">=3.12"` in `backend/pyproject.toml`)

**Secondary:**
- TypeScript - Planned for the frontend (`frontend/`, currently empty); not yet present in the repo
- Bash / PowerShell - Planned start/stop scripts in `scripts/` (directory currently empty)

## Runtime

**Environment:**
- CPython 3.12 (minimum), per `backend/pyproject.toml` and `backend/uv.lock`
- Node 20 (planned, for the frontend static build stage of the Dockerfile; not yet present)
- Python 3.12 slim base image (planned, for the runtime Docker stage per `planning/PLAN.md`)

**Package Manager:**
- `uv` (Python project and lockfile manager)
- Lockfile: present - `backend/uv.lock`
- No `.python-version` or `.nvmrc` file detected

## Frameworks

**Core:**
- FastAPI `0.128.7` (locked) - HTTP API and SSE routing; `backend/app/market/stream.py` uses `APIRouter`, `Request`, and `StreamingResponse`
- Uvicorn `0.40.0` (locked, with `standard` extras) - ASGI server; planned to run the app on port 8000
- Next.js with TypeScript and Tailwind CSS (planned) - Frontend, built as a static export (`output: 'export'`); not yet present in the repo

**Testing:**
- pytest `9.0.2` (locked, dev group) - Test runner; configured under `[tool.pytest.ini_options]` in `backend/pyproject.toml` (`testpaths = ["tests"]`, `asyncio_mode = "auto"`)
- pytest-asyncio `1.3.0` (locked, dev group) - Async test support
- pytest-cov (dev group) - Coverage, configured under `[tool.coverage.*]` (`source = ["app"]`)
- Playwright (planned E2E) - Present only as installed packages under `test/node_modules/` (`@playwright/test`, `playwright`, `typescript`); E2E tests not yet written
- React Testing Library or similar (planned frontend unit tests) - Not yet present

**Build/Dev:**
- hatchling - Build backend for the `backend` package (`[build-system]` in `backend/pyproject.toml`; wheel packages = `["app"]`)
- ruff `0.15.0` (locked, dev group) - Linting and formatting; config in `[tool.ruff]` (line-length 100, target py312, rules E, F, I, N, W; E501 ignored)
- Docker (planned) - Multi-stage build (Node 20 slim, then Python 3.12 slim) per `planning/PLAN.md`; no Dockerfile committed yet

## Key Dependencies

**Critical (declared in `backend/pyproject.toml`):**
- `fastapi>=0.115.0` (locked 0.128.7) - Web framework and API/SSE routing
- `uvicorn[standard]>=0.32.0` (locked 0.40.0) - ASGI server
- `numpy>=2.0.0` (locked 2.4.2) - Used by `backend/app/market/simulator.py` for correlated Gaussian draws (`np.random.standard_normal`) and Cholesky decomposition of the correlation matrix (`np.linalg.cholesky`)
- `massive>=1.0.0` (locked 2.2.0) - Official Massive (Polygon.io) Python client; `backend/app/market/massive_client.py` imports `RESTClient` and `SnapshotMarketType`

**Infrastructure:**
- `rich>=13.0.0` (locked 14.3.2) - Terminal output, used by `backend/market_data_demo.py` for the live demo display
- `litellm` (planned, not yet declared) - LLM gateway to OpenRouter for chat, per `planning/PLAN.md` section 9
- `sqlite3` (Python standard library, planned) - Database at `db/finally.db`; no code using it exists yet

**Dev only (`[project.optional-dependencies] dev`):**
- `pytest>=8.3.0`, `pytest-asyncio>=0.24.0`, `pytest-cov>=5.0.0`, `ruff>=0.7.0`

**Build backend:**
- `hatchling` (build-system requirement)

## Configuration

**Environment:**
- Runtime configuration is read from environment variables. Only `MASSIVE_API_KEY` is read in code today, in `backend/app/market/factory.py` (`os.environ.get("MASSIVE_API_KEY", "").strip()`). The selection rule is: non-empty key selects `MassiveDataSource`, otherwise `SimulatorDataSource`.
- Variables documented in `README.md` and `planning/PLAN.md` but not yet read by code: `OPENROUTER_API_KEY` (required for chat), `LLM_MOCK` (`true` for deterministic mock LLM responses).
- `.env` file present in the project root (contains environment configuration; contents intentionally not read). It is gitignored (`.env`, `.env.*`, with `!.env.example` exception in `.gitignore`). `.env.example` is specified but not yet created.
- Planned database path: `db/finally.db` for local runs; `/app/db/finally.db` inside Docker (named volume `finally-data`). A `DB_PATH` variable is recommended but not yet defined (see `planning/PLAN.md` section 13.2, item 32).

**Build:**
- `backend/pyproject.toml` - Project metadata, dependencies, build system, ruff, pytest, and coverage config
- `backend/uv.lock` - Locked dependency versions
- `.gitignore` - Ignores `.env*`, `node_modules/`, `frontend/.next/`, `frontend/out/`, `.venv/`, `__pycache__/`, `db/*.db*`, Playwright output directories

## CI Configuration

- `.github/workflows/claude.yml` - Runs `anthropics/claude-code-action@v1` on `ubuntu-latest` for `@claude` mentions; not a build or test pipeline
- `.github/workflows/claude-code-review.yml` - Claude Code review workflow; no test or build pipeline detected

## Platform Requirements

**Development:**
- Python 3.12+ and `uv` for the backend (`cd backend && uv sync --dev`)
- Node 20 for the frontend (planned)
- Docker for the single-container deployment (planned)
- Working environment is Windows 11 (Git Bash and PowerShell per `planning/PLAN.md` start-script spec)

**Production:**
- Single Docker container, port 8000, FastAPI serving the API and the static Next.js export (planned)
- SQLite file in a Docker named volume `finally-data` mounted at `/app/db`

---

*Stack analysis: 2026-10-19*
