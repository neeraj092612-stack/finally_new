---
phase: 01-live-market-terminal
plan: 02
subsystem: ui
tags: [nextjs, react, typescript, tailwind, vitest, jsdom, lightweight-charts, npm]

requires:
  - phase: none
    provides: wave 1, no dependencies
provides:
  - Exact-pinned Next.js 16 static-export frontend project with committed package-lock.json
  - Shared Vitest jsdom harness (FakeEventSource, ResizeObserver and matchMedia stubs) reused by later frontend plans
  - Strict TypeScript config with @/* alias, Tailwind v4 PostCSS config
  - Human-approved dependency set (phase's single dependency checkpoint, also approves backend dev dep httpx>=0.27 for plan 01-09)
affects: [01-04, 01-05, 01-08, 01-10, 01-12, 01-14, 01-09]

actuals:
  tokens: 9000
  tasks: 2
  commits: 1

tech-stack:
  added:
    - next 16.3.8
    - react 19.3.0
    - react-dom 19.3.0
    - lightweight-charts 5.2.1
    - "@fontsource/jetbrains-mono 5.3.0"
    - typescript 5.9.3
    - tailwindcss 4.3.3 and @tailwindcss/postcss 4.3.3
    - postcss 8.5.29
    - vitest 5.0.1, jsdom 30.1.3, "@vitejs/plugin-react 6.1.2"
    - "@testing-library/react 16.3.3, jest-dom 7.0.1, user-event 14.6.8"
    - "@types/react 19.3.0, @types/react-dom 19.3.0, @types/node 22.20.5"
  patterns:
    - "Exact pins only (--save-exact), no caret ranges; package-lock.json committed"
    - "Test globals: FakeEventSource installed as global EventSource in vitest.setup.ts"
    - "Vitest alias via fileURLToPath(new URL(...)) for Windows safety"

key-files:
  created:
    - frontend/package.json
    - frontend/package-lock.json
    - frontend/next.config.ts
    - frontend/tsconfig.json
    - frontend/postcss.config.mjs
    - frontend/vitest.config.mts
    - frontend/vitest.setup.ts
    - frontend/src/__tests__/harness.test.ts
  modified:
    - .gitignore

key-decisions:
  - "Installed exactly the pins the human approved at the blocking checkpoint, no substitutions"
  - "Global FakeEventSource typed via an Impl class plus a declare-global var/type pair of the same name, so tests can annotate instances as FakeEventSource"
  - "agentRules: false in next.config.ts plus .gitignore entries for frontend/AGENTS.md and frontend/CLAUDE.md as a second guard"

patterns-established:
  - "Shared harness: later plans call FakeEventSource.reset() in beforeEach and drive streams with emitOpen/emitMessage/emitError"

requirements-completed: [UI-01]

duration: 14min
completed: 2026-10-20
status: complete
---

# Phase 01 Plan 02: Frontend Toolchain and Test Harness Summary

**Next.js 16.3.8 static-export project with the human-approved exact-pinned dependency set, strict TypeScript, Tailwind v4 PostCSS, and a shared Vitest jsdom harness (FakeEventSource as global EventSource, ResizeObserver and matchMedia stubs)**

## Performance

- **Duration:** about 14 min of agent time for the continuation (Task 2); Task 1 was a human checkpoint
- **Completed:** 2026-10-20
- **Tasks:** 2 (Task 1 human-approved, Task 2 executed)
- **Files modified:** 9 (8 created under frontend/, .gitignore modified)

## Accomplishments

- Task 1 (blocking-human checkpoint): the human approved the pinned dependency set ("approved", no changes) before any install. `frontend/package-lock.json` and `frontend/` did not exist when it was presented. No commit (no files).
- Installed the five runtime and thirteen dev packages with `--save-exact`; package.json has no caret ranges and `npm ls --depth=0` matches the lockfile. `npm audit` reported 0 vulnerabilities on both installs.
- `next.config.ts`: `output: "export"`, `images.unoptimized`, `agentRules: false`, and an `/api` rewrite to `127.0.0.1:8000` only when `NODE_ENV === "development"`.
- Shared Vitest harness with an 8-test self-test, all passing; `tsc --noEmit` passes in strict mode with the `@/*` alias.

## Task Commits

1. **Task 1: Approve the pinned dependency set before anything is installed** - no commit (checkpoint approved by human, no files)
2. **Task 2: Frontend project installs the approved pins, type-checks and runs tests on the shared harness** - `da0907f3` (feat)

**Plan metadata:** committed separately after this file (docs: complete plan)

## Files Created/Modified

- `frontend/package.json` - exact-pinned deps; scripts dev, build, test, typecheck
- `frontend/package-lock.json` - committed lockfile (Docker will use `npm ci`)
- `frontend/next.config.ts` - static export, agentRules off, dev-only /api rewrite
- `frontend/tsconfig.json` - strict, bundler resolution, `@/*` -> `./src/*`, Next plugin
- `frontend/postcss.config.mjs` - `@tailwindcss/postcss` plugin
- `frontend/vitest.config.mts` - jsdom, React plugin, setup file, `src/**/*.test.{ts,tsx}`, `@` alias
- `frontend/vitest.setup.ts` - FakeEventSource, ResizeObserver and matchMedia stubs, RTL cleanup, jest-dom matchers
- `frontend/src/__tests__/harness.test.ts` - harness self-test
- `.gitignore` - `frontend/AGENTS.md`, `frontend/CLAUDE.md`

## Decisions Made

- Followed the approved pins exactly. `@testing-library/dom` (a peer of RTL) is installed transitively by npm and is not a top-level pin; it was not in the approved list and is not listed in package.json.
- Typed the global fake with a `FakeEventSourceImpl` class and a `declare global` var/type pair named `FakeEventSource`; a single class with the global declared against its own name triggered TS2502 and TS2749.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Typecheck errors on the global FakeEventSource declaration**
- **Found during:** Task 2 (typecheck run)
- **Issue:** `declare global { var FakeEventSource: typeof FakeEventSource }` was self-referential (TS2502), and tests could not use `FakeEventSource` as a type (TS2749).
- **Fix:** Renamed the class to `FakeEventSourceImpl`; the global declares `var FakeEventSource: typeof FakeEventSourceImpl` plus `type FakeEventSource = FakeEventSourceImpl`.
- **Files modified:** frontend/vitest.setup.ts
- **Verification:** `npm --prefix frontend run typecheck` exits 0; 8/8 tests pass.
- **Committed in:** da0907f3 (part of Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug, caught before the commit)
**Impact on plan:** None on scope; behavior of the harness is as specified.

## Issues Encountered

- `git` emits LF-to-CRLF warnings on Windows for new frontend files (core.autocrlf). Not a failure; the lockfile still installs. If a Linux `npm ci` shows lock drift, the plan that owns the Dockerfile should check line endings (research Pitfall 13 reported `npm ci` works for this tree).

## User Setup Required

None - no external service configuration required.

## Known Stubs

None.

## Threat Flags

None. The only new surface is the development-only `/api` rewrite already covered by T-01-06.

## Next Phase Readiness

- Plan 01-04 can add `src/app`, globals.css and components on top of this project; it should commit whatever the first `next build` rewrites in tsconfig.json.
- Later plans reuse `vitest.setup.ts` unchanged; they should call `FakeEventSource.reset()` in `beforeEach`.
- `lightweight-charts` is not mocked in the harness yet; plans that render charts add `vi.mock("lightweight-charts")` in their own tests.
- Backend dev dependency `httpx>=0.27` is approved for plan 01-09.

## Self-Check: PASSED

- All eight frontend files and the `.gitignore` change exist; commit `da0907f3` is an ancestor of HEAD.
- Acceptance criteria re-run: next pinned 16.3.8, no caret ranges, lockfile present, `output: "export"` and `agentRules: false` present, `frontend/AGENTS.md` in .gitignore, `npm test` 8/8 passing, typecheck exit 0, `npm ls --depth=0` clean, no AGENTS.md or CLAUDE.md under frontend/.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
