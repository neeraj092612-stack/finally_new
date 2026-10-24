---
phase: 01-live-market-terminal
plan: 09
subsystem: testing
tags: [fastapi, error-envelope, httpx, testclient, sqlite, pytest]

requires:
  - phase: 01-live-market-terminal
    provides: "create_app/lifespan, config.Settings, db.init_db, watchlist and portfolio routers (plans 01-01, 01-02, 01-06)"
provides:
  - "PLAN section 8 JSON error envelope for every API failure (ApiError, error_response, install_error_handlers)"
  - "JSON 404 catch-all for unknown /api paths, registered before the static mount"
  - "httpx dev dependency enabling in-process TestClient tests"
  - "Regression tests for DB seeding/persistence and DB_PATH/STATIC_DIR defaults"
affects: [phase-02-trading, frontend-api-client, chat]

actuals:
  tokens: 9500
  tasks: 2
  commits: 4
plan_head_before: 0fc4be688115d5299bfa5e6a074837325ef52b42
plan_head_after: 42e96758c35ebbe98017419dd9e8e4911fcdac68

tech-stack:
  added: ["httpx>=0.27 (dev extra only; lock also gains httpcore)"]
  patterns:
    - "Single {error: {code, message}} body via exception handlers; fixed user-facing messages"
    - "API catch-all registered before the StaticFiles mount; wrong-method calls on known paths stay 405"
    - "Test-only routes prepended to app.router.routes so they beat the catch-all and the static mount"

key-files:
  created:
    - backend/app/errors.py
    - backend/tests/api/__init__.py
    - backend/tests/api/test_errors.py
    - backend/tests/test_db.py
    - backend/tests/test_config.py
  modified:
    - backend/app/main.py
    - backend/tests/conftest.py
    - backend/pyproject.toml
    - backend/uv.lock

key-decisions:
  - "Catch-all inspects the router for a PARTIAL match so a known path with the wrong method returns 405 http_error, not a misleading 404 not_found"
  - "Validation messages are built from the field path and pydantic's message only, never the raw input"

patterns-established:
  - "Error envelope: raise ApiError(code, status, message) anywhere; handlers render it"
  - "autouse conftest fixture removes MASSIVE_API_KEY so lifespans in tests use the simulator"

requirements-completed: [PLAT-02, PLAT-03, PLAT-07]

coverage:
  - id: D1
    description: "Unknown /api paths return a JSON not_found envelope even with the static export mounted; /api/health stays JSON and / stays HTML"
    requirement: PLAT-07
    verification:
      - kind: integration
        ref: "backend/tests/api/test_errors.py#TestUnknownApiPaths"
        status: pass
    human_judgment: false
  - id: D2
    description: "Validation failures, ApiError and framework HTTP errors all render {error: {code, message}}"
    requirement: PLAT-07
    verification:
      - kind: integration
        ref: "backend/tests/api/test_errors.py#TestErrorEnvelope"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty watchlist and never-priced ticker responses; missing static dir does not stop the API"
    requirement: PLAT-07
    verification:
      - kind: integration
        ref: "backend/tests/api/test_errors.py#TestWatchlistEdges"
        status: pass
    human_judgment: false
  - id: D4
    description: "init_db seeds once, never re-seeds a user-emptied watchlist, creates parent dirs, six tables, WAL; Settings defaults pinned"
    requirement: PLAT-02
    verification:
      - kind: unit
        ref: "backend/tests/test_db.py, backend/tests/test_config.py"
        status: pass
    human_judgment: false

duration: 40min
completed: 2026-10-20
status: complete
---

# Phase 1 Plan 09: JSON error envelope, TestClient tests and DB/config edge tests Summary

**FastAPI exception handlers emit the PLAN section 8 `{error: {code, message}}` envelope for every failure, unknown `/api/*` paths get a JSON 404 ahead of the static mount, and httpx-driven tests pin the DB seed, persistence and config defaults.**

## Performance

- **Duration:** about 40 min active (the wall clock spans a usage-limit pause)
- **Started:** 2026-10-20T18:02:29Z
- **Completed:** 2026-10-20T21:40:00Z
- **Tasks:** 2
- **Files modified:** 9 (5 created, 4 modified)

## Accomplishments

- `backend/app/errors.py`: `ApiError`, `error_response`, `install_error_handlers` covering `ApiError`, 422 `invalid_request`, 404 `not_found` and other `http_error` statuses with no internals in messages (T-01-12).
- `/api/{path:path}` catch-all in `create_app` before the static mount, so the frontend's `ApiRequestError` never meets the static HTML 404.
- httpx added to the dev extra only; `uv.lock` diff adds just httpx and httpcore.
- 14 new tests in `tests/api/test_errors.py`, 9 in `tests/test_db.py`, 5 in `tests/test_config.py`. Full suite: 171 passed, ruff clean, `uv lock --check` clean.

## Task Commits

1. **Task 1 setup: httpx + conftest cleanup** - `e6289547` (chore)
2. **Task 1 RED: failing envelope tests** - `f8247c28` (test)
3. **Task 1 GREEN: errors.py + catch-all** - `b8d0360b` (feat)
4. **Task 2: DB and config edge tests** - `42e96758` (test)

**Plan metadata:** committed separately (docs: complete plan)

## TDD Notes

- **RED (Task 1):** 10 of 14 tests failed. Nine failed on assertions for the planned behavior (HTML/`detail` shape instead of the envelope, `KeyError: 'error'`). `test_api_error_renders_its_own_code_status_and_message` failed with `ModuleNotFoundError: app.errors`, which is the intended reason because the module is what the task creates. Semantic assessment: every failure maps to the missing envelope behavior; no collection, fixture or syntax faults. The `gsd_run check tdd-red-evidence` classifier was not run: `workflow.tdd_mode` is not enabled and pytest output is not one of its supported formats.
- **GREEN:** all 14 pass after `errors.py` and the `main.py` change (one follow-up fix, see Deviations).
- **Task 2:** tests pin existing 01-01 behavior, so they pass on first run by design. The re-seed regression was checked against a scratch mutation (unconditional seeding with `INSERT OR IGNORE`): `test_user_deleted_ticker_is_not_reseeded` and `test_user_emptied_watchlist_stays_empty` both failed, then `app/db/__init__.py` was restored (`git diff backend/app` empty).

## Decisions Made

- Wrong-method calls on a known API path return 405 `http_error` (with an `Allow` header), not 404, by checking the router for a partial match in the catch-all.
- Validation message format is `"<field path>: <pydantic message>"`; the raw request value is never echoed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Catch-all turned wrong-method requests into 404**
- **Found during:** Task 1 (GREEN)
- **Issue:** `/api/{path:path}` fully matches every method, so `POST /api/health` returned `not_found` instead of 405, which would mislead clients.
- **Fix:** The catch-all scans `app.router.routes` for a `Match.PARTIAL` route that has `methods` and raises a 405 `StarletteHTTPException` with `Allow`; otherwise it raises `ApiError("not_found", 404, ...)`.
- **Files modified:** `backend/app/main.py`
- **Verification:** `test_method_not_allowed_uses_the_envelope` (added in the RED commit) passes.
- **Committed in:** `b8d0360b`

**2. [Rule 3 - Blocking] uv/CRLF line-ending churn in lock files**
- **Found during:** Task 1 setup
- **Issue:** `uv lock` and the edit rewrote `pyproject.toml` and `uv.lock` with LF while HEAD stores them as CRLF, producing a whole-file diff.
- **Fix:** Converted both back to CRLF; the committed diff is 1 line in pyproject and 30 lines in the lock (httpx, httpcore only).
- **Files modified:** `backend/pyproject.toml`, `backend/uv.lock`
- **Committed in:** `e6289547`

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both necessary; no scope creep. No plan 01-01 defects were found by the Task 2 tests.

## Issues Encountered

- The first `uv sync --extra dev` after `uv lock` hit a Windows "Access is denied" removing an old dist-info; a second `uv sync` completed cleanly.
- `git commit` prints "failed to delete .git/worktrees/agent-..." permission errors for other agents' worktrees during auto-gc; they do not affect these commits.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 2 trade/watchlist endpoints can raise `ApiError(code, status, message)` and get the contract body for free; add the remaining PLAN section 8 codes there (PLAT-04 stays Phase 2).
- `TestClient(create_app(Settings(...)))` is available for later API tests; do not drive `/api/stream/prices` through it.

## Known Stubs

None.

## Threat Flags

None - the only new surface is the `/api/{path:path}` catch-all, which returns a fixed message (covered by T-01-12).

## Self-Check: PASSED

- Files exist: errors.py, tests/api/__init__.py, tests/api/test_errors.py, tests/test_db.py, tests/test_config.py (verified by passing test runs).
- Commits `e6289547`, `f8247c28`, `b8d0360b`, `42e96758` are on the branch (`git rev-list --count` from the base = 4).
- Acceptance criteria: httpx in `uv.lock`, `class ApiError` present, `install_error_handlers(app)` in main.py, catch-all (line 62) before `app.mount(` (line 81), `event_loop_policy` removed.
- Plan verification: pytest 171 passed, ruff exit 0, `uv lock --check` exit 0.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
