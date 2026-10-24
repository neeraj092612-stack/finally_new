---
phase: 01-live-market-terminal
plan: 01
subsystem: api
tags: [fastapi, uvicorn, sqlite, sse, lifespan, staticfiles, pytest]

requires:
  - phase: none
    provides: existing backend/app/market (PriceCache, simulator, stream router, factory)
provides:
  - "create_app(settings) factory with lifespan (init_db -> list_tickers -> source.start -> yield -> source.stop)"
  - "Settings.from_env reading DB_PATH and STATIC_DIR"
  - "SQLite schema for the six PLAN section 7 tables, seeded once with profile (cash 10000.0) and 10 default tickers"
  - "GET /api/health, SSE stream mounted, guarded static mount at /"
  - "Subprocess smoke-test harness (start_server/stop_server) reusable by later plans"
affects: [01-06 REST endpoints, 01-07 stream router fixes, 01-09 error envelope, 01-11 Docker, 01-13 start scripts]

actuals:
  tokens: 6000
  tasks: 2
  commits: 3
plan_head_before: 3d992ee5cc48b1b365b0a93b354828eb11e68983
plan_head_after: e7ccdf2feb8ac14046c102d680d93991ff75eb56

tech-stack:
  added: []
  patterns:
    - "App factory (no module-level app); run with uvicorn app.main:create_app --factory"
    - "Routers built inside factory functions, registered before the catch-all static mount"
    - "Seed only when the profile row is newly inserted (rowcount == 1)"
    - "Subprocess uvicorn smoke test on a free port, terminated by PID only"

key-files:
  created:
    - backend/app/config.py
    - backend/app/db/__init__.py
    - backend/app/db/schema.py
    - backend/app/services/__init__.py
    - backend/app/services/watchlist.py
    - backend/app/api/__init__.py
    - backend/app/api/health.py
    - backend/app/main.py
    - backend/tests/test_server_smoke.py
  modified: []

key-decisions:
  - "Static mount guarded by is_dir() with a warning log, so create_app never raises for a missing export"
  - "Watchlist order uses ORDER BY added_at, rowid because the 10 seed rows share one added_at second"
  - "Restart-persistence test uses its own DB with two sequential servers so it cannot disturb the module-scoped server used by the other tests"

patterns-established:
  - "Lifespan order (D-21): init_db -> read tickers via short-lived closing(connect()) -> start market source -> stop in finally"
  - "All SQL uses ? placeholders; USER_ID is the single module constant"

requirements-completed: [PLAT-01, PLAT-02, PLAT-03, PLAT-05, PLAT-06, PLAT-07]

coverage:
  - id: D1
    description: "One uvicorn process creates and seeds SQLite at DB_PATH (10 tickers, one profile, cash 10000.0) and does not re-seed on restart"
    requirement: "PLAT-02"
    verification:
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_database_is_created_and_seeded"
        status: pass
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_restart_on_same_db_does_not_reseed"
        status: pass
    human_judgment: false
  - id: D2
    description: "SSE /api/stream/prices streams every seeded ticker with the 7 contract keys, starting with retry: 1000"
    requirement: "PLAT-06"
    verification:
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_sse_streams_every_seeded_ticker"
        status: pass
    human_judgment: false
  - id: D3
    description: "GET / serves index.html from STATIC_DIR; create_app tolerates a None or missing static dir; API routes win over the static mount"
    requirement: "PLAT-07"
    verification:
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_root_serves_static_index"
        status: pass
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_api_routes_win_over_static_mount"
        status: pass
      - kind: unit
        ref: "backend/tests/test_server_smoke.py#test_create_app_tolerates_missing_static_dir"
        status: pass
    human_judgment: false
  - id: D4
    description: "GET /api/health returns 200 application/json {status: ok}, also while an SSE client is connected"
    requirement: "PLAT-05"
    verification:
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_health_returns_ok_json"
        status: pass
      - kind: e2e
        ref: "backend/tests/test_server_smoke.py#test_health_answers_while_sse_client_is_connected"
        status: pass
    human_judgment: false

duration: 20min
completed: 2026-10-20
status: complete
---

# Phase 1 Plan 01: Server Walking-Skeleton Tracer Summary

**FastAPI `create_app` factory whose lifespan seeds SQLite (6 tables, 10 tickers, $10,000), starts the simulator with the seeded watchlist, streams it over SSE, serves the static export at `/` behind the API routers, and answers `/api/health`.**

## Performance

- **Duration:** ~20 min
- **Tasks:** 2 (1 tracer, 1 TDD)
- **Files created:** 9 (no existing files modified)

## Accomplishments
- Real-process proof: a subprocess `uvicorn app.main:create_app --factory` creates the DB at `DB_PATH`, seeds once, streams all 10 tickers over SSE, serves `index.html` at `/` and answers `/api/health`.
- Restart on the same DB keeps exactly 10 watchlist rows, one profile and cash 10000.0 (seed gated on the profile insert `rowcount == 1`).
- Reusable `start_server` / `stop_server` helpers in the smoke test for later plans.
- Full backend suite: 82 passed (73 existing + 9 new smoke tests); `ruff check app/ tests/` clean.

## Task Commits

1. **Task 1: Tracer - seed DB, lifespan, SSE, static** - `7ab757c2` (feat)
2. **Task 2 RED: failing health tests** - `a9dc49f2` (test)
3. **Task 2 GREEN: GET /api/health** - `e7ccdf2f` (feat)

No REFACTOR commit: nothing to clean up.

**Tracer gate:** `<verify>` is automated-only and `human_verify_mode` is `end-of-phase`, so the tracer verify (smoke test, full suite, ruff) was re-run before expansion and passed (6 tests, then 79 total); expansion proceeded.

## Files Created/Modified
- `backend/app/config.py` - `Settings` dataclass, `from_env` for `DB_PATH` / `STATIC_DIR`
- `backend/app/db/__init__.py` - `USER_ID`, `STARTING_CASH`, `connect`, `now_iso`, `init_db`
- `backend/app/db/schema.py` - `SCHEMA_SQL` (six tables) and `DEFAULT_TICKERS`
- `backend/app/services/watchlist.py` - `list_tickers(conn)`
- `backend/app/api/health.py` - `create_health_router()`
- `backend/app/main.py` - `create_app` with lifespan and router/static ordering
- `backend/tests/test_server_smoke.py` - subprocess end-to-end smoke tests

## Decisions Made
- Static mount guarded by `is_dir()` plus a warning log rather than failing startup.
- `ORDER BY added_at, rowid` for deterministic watchlist order.
- Restart test uses an isolated DB and two sequential servers instead of stopping the shared module server.

## TDD Gate Compliance (Task 2)

- **RED** (`a9dc49f2`): three target tests (`test_health_returns_ok_json`, `test_health_answers_while_sse_client_is_connected`, `test_api_routes_win_over_static_mount`) failed with `HTTP Error 404` against the running server because `/api/health` did not exist; the other 6 tests passed. Semantic assessment: the failure is the planned assertion (200 and JSON body vs 404), not a load, fixture or syntax fault. The readiness poll was deliberately left on `/` for the RED commit so the server fixture still started and the failures were genuine behavior failures. `gsd_run check tdd-red-evidence` was not run: pytest console output is not among its supported report formats (TAP, JUnit XML, go test, swift-testing, unittest).
- **GREEN** (`e7ccdf2f`): all 82 tests pass.
- **REFACTOR:** not needed.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `backend/.venv` did not exist in the fresh worktree; ran `uv sync --extra dev` once as the plan instructs.
- The first full-suite run showed one failure, `tests/market/test_simulator_source.py::TestSimulatorDataSource::test_custom_update_interval`. It passed on every rerun (alone and in all later full runs), so it is a pre-existing timing-sensitive test in `backend/app/market/` territory (owned by plan 01-03). Out of scope; not touched.
- Python resolved to a uv-managed 3.13 interpreter in this worktree (`requires-python >=3.12`); all code is 3.12-compatible.

## Known Stubs

None.

## Threat Flags

None. New surface (`/api/health`, static mount, SQLite file) is covered by T-01-01 to T-01-05; static serving goes through Starlette `StaticFiles`, all SQL uses `?` placeholders.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Plans 01-06 (REST endpoints and startup snapshot), 01-07 (stream-router and Massive fixes), 01-09 (error envelope) and 01-11 (Docker) can build on `create_app`, `db`, and `services/watchlist.py`.
- Note for 01-07: `create_stream_router` still attaches to a module-level `router`; harmless here because `create_app` calls it once per app, but a second `create_app()` in the same process would register the route twice.

## Self-Check: PASSED

All nine key files exist on disk; commits `7ab757c2`, `a9dc49f2` and `e7ccdf2f` are ancestors of HEAD; the full backend suite (82 tests) and ruff pass.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
