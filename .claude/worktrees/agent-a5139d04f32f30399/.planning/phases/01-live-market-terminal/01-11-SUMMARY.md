---
phase: 01-live-market-terminal
plan: 11
subsystem: infra
tags: [docker, dockerfile, uv, node, nextjs-export, sqlite-volume, healthcheck, dockerignore]

requires:
  - phase: 01-live-market-terminal
    provides: "01-01 create_app factory and Settings.from_env (DB_PATH, STATIC_DIR); 01-04 frontend static export; 01-06 watchlist and portfolio routes; 01-07 SSE stream router"
provides:
  - "Dockerfile: node:20-slim export stage plus python:3.12-slim and uv 0.11.7 runtime, HEALTHCHECK, single-worker uvicorn factory CMD with --timeout-graceful-shutdown 2"
  - ".dockerignore keeping .env, .claude, .planning, node_modules and venvs out of the build context"
  - ".env.example with names-only OPENROUTER_API_KEY, MASSIVE_API_KEY, LLM_MOCK"
  - ".gitattributes forcing LF for *.sh and Dockerfile; db/.gitkeep"
affects: [01-13-start-stop-scripts, 01-14, phase-02, phase-03]

actuals:
  tokens: 1000
  tasks: 2
  commits: 2

plan_head_before: 0fc4be688115d5299bfa5e6a074837325ef52b42
plan_head_after: 895924aa4e5363653977e6072353b671d0e2d15b

tech-stack:
  added: [docker multi-stage build, "uv 0.11.7 (image pin)"]
  patterns:
    - "Lockfile-strict builds: npm ci and uv sync --frozen, no dev extra in the runtime image"
    - "Targeted COPY (backend/app, lockfiles, export) plus .dockerignore so secrets and agent dirs never enter layers"
    - "Single uvicorn process so one in-memory PriceCache serves all SSE clients"

key-files:
  created: [Dockerfile, .dockerignore, .env.example, .gitattributes, db/.gitkeep]
  modified: []

key-decisions:
  - "Followed RESEARCH C-9 Dockerfile verbatim: DB_PATH=/app/db/finally.db and STATIC_DIR=/app/static set as image ENV"
  - "Removed the double-quotes from the .env.example comment line so the file contains no quote characters at all (docker --env-file keeps quotes literally)"
  - ".gitattributes applies going forward only; no renormalize of existing files"

patterns-established:
  - "Container verification uses only finally-phase1-test / finally-data-phase1-test on host port 18000; the user's finally-data volume is never mounted"

requirements-completed: [DEP-01, DEP-02, PLAT-02, PLAT-07]

coverage:
  - id: D1
    description: "docker build -t finally . produces one image that serves static export, /api/* and SSE on 8000"
    requirement: DEP-01
    verification:
      - kind: integration
        ref: "docker build -t finally . then curl /api/health, /api/watchlist (NFLX), /api/portfolio (cash 10000.0), / (FinAlly), /api/stream/prices (day_change_percent) against finally-phase1-test"
        status: pass
    human_judgment: false
  - id: D2
    description: "SQLite data persists across docker restart on a named volume (portfolio_snapshots 1 -> 2)"
    requirement: PLAT-02
    verification:
      - kind: integration
        ref: "docker exec python sqlite3 count before and after docker restart on finally-data-phase1-test"
        status: pass
    human_judgment: false
  - id: D3
    description: "docker stop with an open SSE client exits 0 within the stop timeout"
    requirement: DEP-01
    verification:
      - kind: integration
        ref: "docker stop -t 10 with a curl SSE client attached; docker inspect ExitCode = 0"
        status: pass
    human_judgment: false
  - id: D4
    description: ".env.example is names-only and the image contains no .env, .claude, .planning or node_modules"
    requirement: DEP-02
    verification:
      - kind: other
        ref: "grep acceptance checks on .env.example and .dockerignore; docker run --entrypoint ls finally -A /app /app/static"
        status: pass
    human_judgment: false
  - id: D5
    description: "Static export is served by FastAPI from inside the container"
    requirement: PLAT-07
    verification:
      - kind: integration
        ref: "curl http://127.0.0.1:18000/ contains FinAlly"
        status: pass
    human_judgment: false

duration: 15min
completed: 2026-10-20
status: complete
---

# Phase 1 Plan 11: Docker Packaging Summary

**Multi-stage Dockerfile (node:20-slim export + python:3.12-slim/uv 0.11.7) that serves the static export, REST and SSE on port 8000 with a /api/health HEALTHCHECK, persists SQLite on a named volume, and stops cleanly with open SSE clients**

## Performance

- **Duration:** about 15 min (dominated by one cold image build)
- **Completed:** 2026-10-20T21:43Z
- **Tasks:** 2
- **Files modified:** 5 (all new)

## Accomplishments

- `.env.example` (names only, unquoted, comments on their own lines), `.dockerignore`, `.gitattributes` (LF for `*.sh` and `Dockerfile`) and `db/.gitkeep` committed; none are git-ignored.
- `docker build -t finally .` succeeds from the committed lockfiles (`npm ci`, `uv sync --frozen`, no dev extra).
- Test container `finally-phase1-test` on volume `finally-data-phase1-test` (127.0.0.1:18000): `/api/health` returns `{"status":"ok"}`, watchlist contains NFLX, portfolio cash is `10000.0`, `/` contains FinAlly, and the first SSE `data:` line carries `day_change_percent`.
- Persistence: `portfolio_snapshots` count was 1 on the fresh volume and 2 after `docker restart`.
- `docker stop -t 10` with a live SSE client attached exited with code 0.
- Image contents: `/app` holds only `README.md`, `app`, `db`, `pyproject.toml`, `static`, `uv.lock`; `/app/static/index.html` is present; no `.env`, `.claude`, `.planning` or `node_modules`.
- The user's `finally-data` volume was never mounted or modified and still exists; only my own test container and test volume were removed.

## Task Commits

1. **Task 1: names-only .env.example, .dockerignore, .gitattributes, db/.gitkeep** - `bc593523` (chore)
2. **Task 2: multi-stage Dockerfile** - `895924aa` (feat)

**Plan metadata:** committed separately as the docs commit for this SUMMARY.

## Files Created/Modified

- `Dockerfile` - two-stage build, HEALTHCHECK, `uvicorn app.main:create_app --factory ... --timeout-graceful-shutdown 2`
- `.dockerignore` - excludes secrets, agent/planning dirs, node_modules, venvs and caches
- `.env.example` - OPENROUTER_API_KEY, MASSIVE_API_KEY, LLM_MOCK placeholders
- `.gitattributes` - `*.sh text eol=lf`, `Dockerfile text eol=lf`
- `db/.gitkeep` - keeps the local run directory in the repo

## Decisions Made

- Used the RESEARCH C-9 Dockerfile as written; no deviations were needed because the app factory, Settings and routes from plans 01-01/04/06/07 already matched.
- Dropped the quote characters from the `.env.example` LLM_MOCK comment so the acceptance check "no quotes" holds literally.

## Deviations from Plan

None - plan executed exactly as written (the one wording tweak to a `.env.example` comment is within the task's "no quotes" criterion, not a deviation).

## Issues Encountered

- Git printed `failed to delete ... .git/worktrees/agent-...: Permission denied` on each commit (auto-gc trying to prune unrelated sibling worktree metadata). The commits succeeded; no action taken.
- `curl` printed `Empty reply from server` during the first seconds after `docker run` while uvicorn started; `--retry-all-errors` covered it and health then passed.
- The Docker image build emitted a one-time git CRLF notice for the new files; `.gitattributes` handles future checkouts and no existing file was renormalized.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None - the image adds no new network surface beyond the planned port 8000. T-01-21 (runs as root) remains accepted per the plan.

## Next Phase Readiness

- Image tag `finally` is ready for the start/stop scripts in plan 01-13 (`docker run -v finally-data:/app/db -p 127.0.0.1:8000:8000 --env-file .env finally`).
- The container image at this worktree base contains whatever frontend exists on the merged base; sibling plans 01-08 and 01-10 add frontend components that a rebuild after merge will pick up.

## Self-Check: PASSED

- FOUND: Dockerfile, .dockerignore, .env.example, .gitattributes, db/.gitkeep
- FOUND commits: bc593523, 895924aa
- `docker volume inspect finally-data` still succeeds.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
