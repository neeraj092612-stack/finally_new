---
phase: 01-live-market-terminal
plan: 13
subsystem: infra
tags: [docker, bash, powershell, scripts, deployment, docs]

requires:
  - phase: 01-live-market-terminal
    provides: "Plan 01-11 Dockerfile (image tag finally, /app/db volume path, /api/health HEALTHCHECK), .env.example, .gitattributes LF rule"
provides:
  - "scripts/start_mac.sh and scripts/start_windows.ps1: build when needed or on --build, replace the same-name container, bind 127.0.0.1:PORT -> 8000, warn when .env is missing, wait for healthy, print URL"
  - "scripts/stop_mac.sh and scripts/stop_windows.ps1: remove only the container, keep the data volume, safe when nothing is running"
  - "FINALLY_CONTAINER / FINALLY_VOLUME / FINALLY_PORT overrides (defaults finally-app, finally-data, 8000)"
  - "planning/PLAN.md write-back of every section 13.2 decision implemented in phase 1 (D-23)"
affects: [phase-02, phase-03, phase-05-e2e]

actuals:
  tokens: 14000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Env-var overrides on scripts so verification uses a throwaway container/volume/port"
    - "bash 3.2-safe empty-array expansion; PowerShell 5.1 scripts keep the default error preference and test $LASTEXITCODE"

key-files:
  created:
    - scripts/start_mac.sh
    - scripts/stop_mac.sh
    - scripts/start_windows.ps1
    - scripts/stop_windows.ps1
  modified:
    - planning/PLAN.md

key-decisions:
  - "Stop scripts look up the container before removing it: docker rm -f exits 0 for a missing container, so without the lookup the 'not running' message could never print"
  - "DB_PATH and STATIC_DIR are documented in PLAN.md section 5 as commented-out optional variables and are not in .env.example: an empty value in --env-file would override the Dockerfile ENV inside the container"
  - "Start scripts build before removing the old container, so a failed build never takes down a running app"

patterns-established:
  - "Scripts never print, parse or copy .env; they only pass --env-file .env"
  - "Scripts never remove volumes or images"

requirements-completed: [DEP-03, DEP-02]

duration: 25min
completed: 2026-10-20
status: complete
plan_head_before: 3b4d0c3b48df8b618626ed576fecdda0551d857a
plan_head_after: feadd9faf7c467783cddb4d3e7593b251c7bbc6e

coverage:
  - id: D1
    description: "start_mac.sh builds when the image is missing or on --build, replaces any same-name container, publishes only 127.0.0.1:PORT, and starts healthy; two runs leave exactly one container"
    requirement: DEP-03
    verification:
      - kind: integration
        ref: "FINALLY_CONTAINER=finally-phase1-test FINALLY_VOLUME=finally-data-phase1-test FINALLY_PORT=18000 bash scripts/start_mac.sh (x2); docker ps count == 1; docker port -> 127.0.0.1:18000; GET /api/health -> {\"status\":\"ok\"}"
        status: pass
      - kind: integration
        ref: "bash scripts/start_mac.sh --build (rebuilt the finally tag, started healthy)"
        status: pass
    human_judgment: false
  - id: D2
    description: "A missing .env prints the warning to stderr and still starts; an existing .env is passed with --env-file"
    requirement: DEP-02
    verification:
      - kind: integration
        ref: "start_mac.sh from a git-ls-files copy without .env prints 'WARNING: .env not found' and the container runs; with a scratch .env containing LLM_MOCK=false, docker inspect shows LLM_MOCK=false"
        status: pass
    human_judgment: false
  - id: D3
    description: "stop_mac.sh removes only the container, keeps both the test volume and the user's finally-data volume, and succeeds when nothing is running"
    requirement: DEP-03
    verification:
      - kind: integration
        ref: "start_mac.sh; stop_mac.sh; stop_mac.sh (second prints 'is not running'); docker volume inspect finally-data-phase1-test finally-data"
        status: pass
    human_judgment: false
  - id: D4
    description: "start_windows.ps1 and stop_windows.ps1 behave the same as the bash scripts under Windows PowerShell 5.1"
    requirement: DEP-03
    verification: []
    human_judgment: true
    rationale: "The executor sandbox refuses to launch powershell, so the plan's PowerShell verify step could not run. The scripts were reviewed statically against RESEARCH Pitfall 9 only; run the plan's third automated verify block on the main checkout."
  - id: D5
    description: "planning/PLAN.md records the phase 1 decisions (items 6, 8, 12, 13, 14, 30, 31, 32), additive SSE keys, backend/app/db layout, DB_PATH/STATIC_DIR, loopback binding, uvicorn flags and FINALLY_* overrides, and 13.2 lists only open items"
    verification:
      - kind: other
        ref: "plan verify: six positive greps present, three negative greps absent, items 11,17,18,19,21,22,23,26,27,29 still in 13.2"
        status: pass
    human_judgment: false
---

# Phase 1 Plan 13: Start/Stop Scripts and PLAN.md Write-back Summary

**One-command Docker launch: bash and PowerShell start/stop scripts that bind the app to loopback, warn on a missing .env, never touch volumes, and a PLAN.md updated with every phase 1 decision.**

## Performance

- **Duration:** about 25 min
- **Started:** 2026-10-20T21:40:00Z (approx.)
- **Completed:** 2026-10-20T22:05:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Both start scripts build the `finally` image when it is missing or `--build` is passed, remove any container of the same name, run one container with the named volume on `127.0.0.1:PORT -> 8000`, wait up to 60 s for the Docker health check, and print the URL.
- A missing `.env` produces a stderr warning and the container still starts; an existing `.env` is passed with `--env-file` and was confirmed inside the container.
- Both stop scripts remove only the container and report accurately whether anything was running.
- `planning/PLAN.md` now documents the lifespan DB init, `backend/app/db/`, `DB_PATH`/`STATIC_DIR`, additive SSE keys, the day-change baseline, framework error codes, the connection-dot mapping, browser-only history, the uvicorn flags, loopback binding and script overrides; section 13.1 gained one row per decision and 13.2 lists only open items.

## Task Commits

1. **Task 1: Start/stop scripts (macOS/Linux and Windows)** - `563cf1d1` (feat)
2. **Task 2: PLAN.md write-back (D-23)** - `feadd9fa` (docs)

**Plan metadata:** committed with this SUMMARY (docs: complete plan)

## Files Created/Modified

- `scripts/start_mac.sh` - Bash start script (also Git Bash), `--build` only flag, env overrides
- `scripts/stop_mac.sh` - Bash stop script, keeps the volume
- `scripts/start_windows.ps1` - PowerShell 5.1 start script, `-Build` / `--build`
- `scripts/stop_windows.ps1` - PowerShell stop script, keeps the volume
- `planning/PLAN.md` - sections 4, 5, 6, 7, 8, 10, 11, 13.1-13.3 updated

## Decisions Made

- Stop scripts check for the container first (`docker ps -aq --filter name=^NAME$`) because `docker rm -f` exits 0 for a missing container.
- `DB_PATH` and `STATIC_DIR` appear in the PLAN.md section 5 variable block as comments, not in `.env.example`, because an empty value in `--env-file` overrides the Dockerfile `ENV` (the backend treats empty as unset and would then fall back to repo-local paths inside the container).
- Beyond the plan's list, PLAN.md section 7 heading now reads "SQLite with Startup Initialization" so it matches the lifespan decision.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stop script reported "Stopped" when nothing was running**
- **Found during:** Task 1 verification
- **Issue:** `docker rm -f` of a missing container exits 0, so the "is not running" branch was unreachable
- **Fix:** look up the container with `docker ps -aq --filter` before removing it (bash and PowerShell)
- **Files modified:** scripts/stop_mac.sh, scripts/stop_windows.ps1
- **Verification:** second `stop_mac.sh` run prints `finally-phase1-test is not running (data volume finally-data-phase1-test kept).`
- **Committed in:** 563cf1d1

**2. [Rule 1 - Bug] A comment in start_windows.ps1 contained the banned literal**
- **Found during:** Task 1 acceptance criteria
- **Issue:** the comment spelled out the stop-on-error preference assignment, failing `! grep "ErrorActionPreference = 'Stop'"`
- **Fix:** reworded the comment
- **Committed in:** 563cf1d1

---

**Total deviations:** 2 auto-fixed (2 bugs). **Impact on plan:** none on scope.

## Issues Encountered

- **PowerShell verification not run.** The executor sandbox blocks launching `powershell` ("shell text cannot be shown not to run git"), so verify block 3 (start_windows.ps1 / stop_windows.ps1 with `--build`, duplicate-container and keep-volume checks) did not execute. Static review only. Recommended: run that block from the main checkout with the `finally-phase1-test` names and port 18000. The PowerShell scripts also pass no parse check yet.
- The plan's verify commands use compound shell constructs the sandbox rejects, so they were run as equivalent separate commands (same assertions: exactly one container, `docker port` -> `127.0.0.1:18000`, `/api/health` ok, warning text present, volumes intact).
- `git commit` prints `failed to delete .git/worktrees/...: Permission denied` from automatic gc of other worktrees; commits succeed.
- The per-plan commit ledger file could not be written under `.git/` by the Write tool; `plan_head_before` is the known base `3b4d0c3b` from the dispatch prompt.

## Verification Safety

- Only container `finally-phase1-test`, volume `finally-data-phase1-test` and port 18000 were used. The user's `finally-data` volume still exists. The `finally` tag was rebuilt once via `--build` (allowed); no image, volume or prune command was run. The test container is stopped and removed; the test volume remains. Repo-root `.env` was never read.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Next Phase Readiness

- ROADMAP success criterion 1 is deliverable on macOS/Linux and Git Bash; the Windows PowerShell path needs one confirming run (see Issues Encountered).

## Self-Check: PASSED

- scripts/start_mac.sh, stop_mac.sh, start_windows.ps1, stop_windows.ps1, planning/PLAN.md exist; commits 563cf1d1 and feadd9fa are ancestors of HEAD; `git ls-files --eol` reports `i/lf` for both .sh files.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
