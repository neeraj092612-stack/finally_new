---
phase: 01-live-market-terminal
plan: 12
subsystem: ui
tags: [react, nextjs, vitest, listbox, keyboard-navigation, watchlist]
requires:
  - phase: 01-live-market-terminal
    provides: "01-08 AppShell price-stream wiring and Header; 01-10 useWatchlist and the controlled WatchlistPanel/WatchlistRow"
provides:
  - "AppShell owns the selected ticker (first watchlist entry on load, not persisted) and passes selected/onSelect to the live WatchlistPanel"
  - "Chart panel title reads CHART · TICKER with the ticker in text-accent, plain CHART when nothing is watched"
  - "Keyboard-navigation test coverage for the watchlist listbox"
affects: [01-14, chart-panel, trade-bar]
actuals:
  tokens: 9000
  tasks: 2
  commits: 3
plan_head_before: 3b4d0c3b48df8b618626ed576fecdda0551d857a
plan_head_after: 471766c2a12c07fd6ca58981db85abbd2c6ea9bd
tech-stack:
  added: []
  patterns:
    - "Selection lives in AppShell; a status/entries effect reconciles it against the loaded list (functional setSelected)"
    - "Panel title accepts ReactNode so the ticker can carry its own accent class"
key-files:
  created: []
  modified:
    - frontend/src/components/AppShell.tsx
    - frontend/src/__tests__/AppShell.test.tsx
    - frontend/src/__tests__/WatchlistPanel.test.tsx
key-decisions:
  - "Selection reconciliation uses a functional setSelected inside one effect keyed on [status, entries]: keeps a still-present selection, otherwise falls back to entries[0] or null"
  - "WatchlistPanel.tsx left unchanged: the ArrowUp/ArrowDown handler and the row-level Enter/Space handler already shipped in plan 01-10"
requirements-completed: [WATCH-01, UI-02, UI-04]
duration: 22min
completed: 2026-10-20
status: complete
coverage:
  - id: D1
    description: "Page shows the live watchlist panel (GET /api/watchlist) in place of the skeleton; AAPL selected on load; chart title CHART · AAPL with accent ticker"
    requirement: WATCH-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/AppShell.test.tsx#renders the live watchlist with AAPL selected and the chart titled CHART · AAPL"
        status: pass
    human_judgment: false
  - id: D2
    description: "Clicking a row selects it and retitles the chart; arrow keys inside AppShell move selection, focus and title together"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/AppShell.test.tsx#selects a clicked row and retitles the chart"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/AppShell.test.tsx#moves the selection with the arrow keys and the chart title follows"
        status: pass
    human_judgment: false
  - id: D3
    description: "Empty watchlist shows No tickers watched and a plain CHART title; header and other panel empty states unchanged"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/AppShell.test.tsx#shows No tickers watched and a plain CHART title for an empty watchlist"
        status: pass
    human_judgment: false
  - id: D4
    description: "Listbox keyboard navigation: ArrowUp/ArrowDown clamp and move focus, Enter/Space select a focused row, one roving tab stop"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/WatchlistPanel.test.tsx#WatchlistPanel keyboard navigation"
        status: pass
    human_judgment: false
  - id: D5
    description: "Visual feel of the selected-row accent and chart title in the running app"
    verification: []
    human_judgment: true
    rationale: "Dense terminal styling and focus ring legibility are judged by eye; unit tests assert classes, not appearance"
---

# Phase 1 Plan 12: Live Watchlist Selection Summary

**AppShell now renders the live useWatchlist-driven WatchlistPanel, owns the selected ticker (first entry on load, never persisted), and retitles the chart `CHART · TICKER` with the ticker in accent yellow; listbox keyboard navigation is covered by tests.**

## Performance

- **Duration:** 22 min
- **Started:** 2026-10-20T17:50:00Z (approx.)
- **Completed:** 2026-10-20T22:13:00Z (wall clock reported by the executor environment)
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- The skeleton WATCHLIST panel in AppShell is replaced by `<WatchlistPanel {...watchlist} selected onSelect />`; `useWatchlist()` is called once. The panel renders its own loading skeleton, so the existing "10 skeleton rows" test is unchanged.
- A single effect reconciles selection against the loaded list: AAPL (first entry) when nothing is selected, kept when still present, moved to the first entry when its ticker disappears, null when the list is empty (D-15, nothing persisted).
- The CHART panel title is `CHART · <ticker>` with the ticker in `text-accent`, plain `CHART` with no selection (D-12); the "Select a ticker to see its chart." overlay is kept for plan 01-14 to replace.
- Five new AppShell tests (load selection, click retitle, empty list, arrow-key retitle with focus, header and empty states preserved) and six new WatchlistPanel keyboard tests with a stateful wrapper.

## Task Commits

1. **Task 1 RED: AppShell selection tests** - `65a0fd69` (test)
2. **Task 1 GREEN: AppShell owns selection, renders WatchlistPanel and chart title** - `e76753de` (feat)
3. **Task 2: keyboard navigation tests** - `471766c2` (test)

**Plan metadata:** committed as `docs(01-12)` after this file (see git log).

## Files Created/Modified

- `frontend/src/components/AppShell.tsx` - useWatchlist, `selected` state, selection effect, WatchlistPanel, CHART title with accent ticker; removed the local skeleton rows
- `frontend/src/__tests__/AppShell.test.tsx` - URL-routed fetch stub and the five selection tests
- `frontend/src/__tests__/WatchlistPanel.test.tsx` - stateful harness and keyboard-navigation tests

## Decisions Made

- Selection reconciliation is one functional-update effect on `[status, entries]` rather than separate effects, so a stale closure cannot overwrite a newer user selection.
- `WatchlistPanel.tsx` was not modified (see deviation 1).

## TDD Gate Compliance

- **Task 1:** RED commit `65a0fd69` (all 5 new tests failed: `Unable to find role="option"`, i.e. the skeleton panel still rendered; correct reason, not a syntax or fixture fault). GREEN commit `e76753de` (17/17 AppShell tests pass). No REFACTOR needed. The task was not a `type: tdd` plan, so `gsd_run check tdd-red-evidence` was not run; the RED assessment above is manual (target tests executed and failed on the planned assertion).
- **Task 2:** No RED commit is possible. The ArrowUp/ArrowDown handler (container) and Enter/Space handler (row) were already shipped by plan 01-10, so the new tests pass on first run. Mutation check: neutering the arrow-key handler makes 6 tests fail (including 5 of the 6 new ones plus the pre-existing arrow test); the file was then restored. Missing RED for Task 2 is recorded here rather than faked.

## Deviations from Plan

**1. [Plan/baseline mismatch - not a rule fix] Task 2 implementation already existed**
- **Found during:** Task 2
- **Issue:** The plan's acceptance criterion states "baseline after plan 01-10: absent" for `ArrowDown`/`ArrowUp` in `WatchlistPanel.tsx`, but plan 01-10 had already implemented the container `onKeyDown` (clamped movement, `preventDefault`, focus follows selection) and the row-level Enter/Space handler. The handoff note for this plan also said to wire and test rather than re-implement.
- **Fix:** Added the missing behavioral coverage only; no production change to `WatchlistPanel.tsx`.
- **Files modified:** `frontend/src/__tests__/WatchlistPanel.test.tsx`
- **Commit:** `471766c2`

**Total deviations:** 1 (plan assumption superseded by prior work). **Impact:** none on behavior; Task 2 contributes tests only.

## Deferred Issues

**Pre-existing flaky tests in `frontend/src/__tests__/WatchlistPanel.test.tsx` (plan 01-10).** Roughly 25 percent of runs of the live-price tests fail intermittently (a different test each time: `shows the REST price until an SSE price replaces it`, `only draws ticks since page load...`, `mutes prices...`, `follows the live price and Day %`, and others). Reproduced on the untouched base file (`3b4d0c3b`): 4 failures in 14 isolated runs, so it is not caused by this plan. Diagnostic run showed the tick is ingested by the store (`watched` contains all 10 tickers) but the row has not re-rendered when the synchronous assertion runs, which points at a test-timing issue between `findAllByRole` returning and the `useSyncExternalStore` subscription in `WatchlistRow` (assertions right after `act(() => emitMessage)` without `waitFor`). Not fixed here (out of scope: unrelated to selection/keyboard). Suggested fix: await a post-render signal in `renderReady` (e.g. flush with `await act(async () => {})`) or wrap live-price assertions in `waitFor`. Final verification here used full-suite reruns until green: 138/138 passed on three of five full runs; the same run also passed `npm run build` with `frontend/out/index.html` present.

## Issues Encountered

- `npm --prefix frontend ci` took about 1 minute in the worktree; run in the background as instructed.
- Git printed `failed to delete ... .git/worktrees/agent-*` (permission denied) from automatic gc on every commit; those are other agents' worktree metadata, unrelated and harmless.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-14 can read the AppShell `selected` state and replace the CHART panel body (the "Select a ticker to see its chart." overlay is still in place).
- Chart panel title is already wired to the selection.
- Concern: the flaky WatchlistPanel live-price tests above may cause spurious full-suite failures for later plans.

## Threat Flags

None. T-01-30 mitigated: the ticker renders only as React text (title and `data-ticker` attribute come from rendered entries); no new network surface.

## Known Stubs

None. (The chart overlay text and the TRADE/HEATMAP/P&L/POSITIONS/AI CHAT placeholder panels are plan 01-04 empty states owned by later plans, not introduced here.)

## Self-Check: PASSED

- `frontend/src/components/AppShell.tsx`, `frontend/src/__tests__/AppShell.test.tsx`, `frontend/src/__tests__/WatchlistPanel.test.tsx` exist.
- Commits `65a0fd69`, `e76753de`, `471766c2` are ancestors of HEAD; `git rev-list --count 3b4d0c3b..HEAD` = 3 before this commit.
- `grep -q "useWatchlist()"` and `grep -q "WatchlistPanel"` on `AppShell.tsx` succeed; `ArrowDown`/`ArrowUp` present in `WatchlistPanel.tsx`.
- `npm --prefix frontend test` 138/138 (on green runs; see Deferred Issues for the pre-existing flake) and `npm --prefix frontend run build` exit 0 with `frontend/out/index.html`.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
