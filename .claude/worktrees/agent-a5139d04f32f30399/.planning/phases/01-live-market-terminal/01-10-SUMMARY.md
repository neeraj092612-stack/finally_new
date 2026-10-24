---
phase: 01-live-market-terminal
plan: 10
subsystem: ui
tags: [react, sse, svg, sparkline, watchlist, vitest, tailwind, typescript]

requires:
  - phase: 01-live-market-terminal
    provides: "Plan 01-04 Panel chrome, theme tokens and flash keyframes; plan 01-05 price store, formatters and fetchWatchlist; plan 01-06 GET /api/watchlist with day_change_percent"
provides:
  - "useWatchlist hook (loading/error/ready, retry) that scopes the price store to watched tickers"
  - "WatchlistPanel (skeleton, error with Retry watchlist, empty state, listbox with arrow-key selection)"
  - "WatchlistRow (28px option row, accent-bar selection, colored Day %, row aria-label)"
  - "PriceCell (keyed flash span, persistent up/down marker, muted when not live)"
  - "Sparkline SVG polyline plus lib/sparkline.ts (sparklineWindow, sparklinePoints, sparklineTrend, SPARK_WINDOW_SECONDS, SPARK_MAX_POINTS)"
affects: [01-12-app-wiring, 01-14-chart]

actuals:
  tokens: 21000
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Timer-free flash: price span keyed by the store's flash seq so a new non-flat tick remounts it and restarts the CSS animation"
    - "Rows read the shared price store snapshot; sparkline values recomputed with useMemo keyed on store version because tick buffers mutate in place"
    - "TDD skeleton commit: RED commits carry API-surface stubs so tests fail on behavioral assertions, not import errors"

key-files:
  created:
    - frontend/src/lib/useWatchlist.ts
    - frontend/src/lib/sparkline.ts
    - frontend/src/components/PriceCell.tsx
    - frontend/src/components/Sparkline.tsx
    - frontend/src/components/WatchlistRow.tsx
    - frontend/src/components/WatchlistPanel.tsx
    - frontend/src/__tests__/PriceCell.test.tsx
    - frontend/src/__tests__/WatchlistPanel.test.tsx
    - frontend/src/__tests__/sparkline.test.tsx
  modified: []

key-decisions:
  - "WatchlistPanel accepts an optional className prop (not in the plan's prop list) so plan 01-12 can place it in the grid without editing the panel"
  - "ArrowUp/ArrowDown and Enter/Space selection are implemented inside the panel and row (UI-SPEC keyboard default) with DOM focus following the selection; the panel stays controlled, so 01-12 owns the selected state"
  - "Row aria-label omits the percent clause when a price is known but Day % is null ('GOOGL, 101.00') rather than inventing a value"
  - "Day % falls back to the REST value when an SSE tick carries a null day_change_percent"

patterns-established:
  - "Components under frontend/src/components that use hooks carry 'use client'; the Panel stays server-neutral"
  - "Value is classified as zero by rounding to hundredths so 0.004 displays and colors as 0.00 muted"

requirements-completed: [UI-02, WATCH-01]

coverage:
  - id: D1
    description: "Watchlist rows follow GET /api/watchlist order in a labelled listbox with the selected row marked (accent bar, surface-2, only it tabbable) and click/Enter/Space/arrow selection"
    requirement: WATCH-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/WatchlistPanel.test.tsx#WatchlistPanel states and selection"
        status: pass
    human_judgment: false
  - id: D2
    description: "Loading (10 skeleton rows), error (heading, body, Retry watchlist refetch), empty, single-row and long-symbol truncation states"
    requirement: WATCH-01
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/WatchlistPanel.test.tsx#WatchlistPanel states"
        status: pass
    human_judgment: false
  - id: D3
    description: "Prices flash only on a new non-flat tick (not first tick, flat, resent timestamp, or stream not OPEN); marker persists through flat ticks; prices mute when not live; missing price renders a dash"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/PriceCell.test.tsx"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/WatchlistPanel.test.tsx#WatchlistPanel live prices"
        status: pass
    human_judgment: false
  - id: D4
    description: "Sparklines from ticks since page load (300 s / 600 points), x spread across full width, dashed baseline under 2 points, stroke colored by trend"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/sparkline.test.tsx"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/WatchlistPanel.test.tsx#WatchlistRow sparkline"
        status: pass
    human_judgment: false
  - id: D5
    description: "Day % signed 2 dp, colored by sign, muted at 0.00, dash when null, SSE value overrides REST; row aria-label forms"
    requirement: UI-02
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/WatchlistPanel.test.tsx#WatchlistRow Day % and aria-label"
        status: pass
    human_judgment: false
  - id: D6
    description: "Visual quality of the flash fade, row density and sparkline appearance in a real browser"
    verification: []
    human_judgment: true
    rationale: "Tests assert class names and DOM structure; the 500ms CSS fade, colors and layout need eyes once plan 01-12 mounts the panel in the page"

duration: 11min
completed: 2026-10-20
plan_head_before: 0fc4be688115d5299bfa5e6a074837325ef52b42
plan_head_after: ffa1a3a0fbeadbb90d8bc046565b4755b741cd07
status: complete
---

# Phase 01 Plan 10: Live Watchlist Panel Summary

**Standalone live watchlist: 28px option rows whose price cells flash via a flash-seq-keyed span, persistent up/down markers, hand-rolled SVG sparklines that fill in since page load, a sign-colored Day %, and skeleton/error/empty states, all driven by the shared SSE price store**

## Performance

- **Duration:** 11 min
- **Started:** 2026-10-20T21:34:00Z
- **Completed:** 2026-10-20T21:45:19Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 9 (all new)

## Accomplishments
- `useWatchlist` loads `GET /api/watchlist`, exposes `status`/`entries`/`retry`, and registers the watched tickers so the store ignores unwatched SSE entries.
- `PriceCell` flashes only the price span: keyed by the store's `flash.seq`, class `flash-up`/`flash-down` only when the stream is OPEN; marker triangle persists through flat ticks; muted when not live; dash (never 0) when null. No live region.
- `WatchlistPanel` renders 10 skeleton rows, the documented error copy with a working "Retry watchlist", the "No tickers watched" empty state, or a `role="listbox"` that scrolls at desktop width under a fixed title and column header.
- `WatchlistRow` is a 28px `role="option"` with a 4px accent bar and `surface-2` when selected, roving tabindex, truncating ticker with `title`, trend-colored sparkline, Day % (SSE over REST), and aria-labels like `AAPL, 190.24, up 0.65 percent` / `AAPL, no price yet`.
- `lib/sparkline.ts` + `Sparkline`: last-300 s / 600-point window, x spread over the full width, 2px vertical padding, flat series at mid-height, dashed baseline under 2 points.

## Task Commits

1. **Task 1: watchlist panel, rows, price cell, load states**
   - RED `61fa45e1` (test) — 26 tests, all failing on assertions against render-nothing stubs
   - GREEN `212a5fbb` (feat) — 26 passing
2. **Task 2: sparklines and Day %**
   - RED `2caeef13` (test) — 23 failing assertions (sparkline math, Sparkline SVG, Day %, aria-label)
   - GREEN `ffa1a3a0` (feat) — full suite 112 passing, typecheck clean

No REFACTOR commit: nothing needed cleanup after GREEN.

## TDD Gate Compliance

- RED evidence, Task 1: `npm --prefix frontend test -- src/__tests__/WatchlistPanel.test.tsx src/__tests__/PriceCell.test.tsx` exited non-zero with 26 failed / 0 passed; failures were "Unable to find role=option" and missing text/class assertions, i.e. the target tests executed and failed on the planned behavior. Semantic assessment: valid RED (no import, syntax or fixture errors; stubs compile and render null).
- RED evidence, Task 2: 23 failed / 22 passed (the 22 were Task 1 tests plus the constants test, which the stub already satisfies). Failures were value mismatches (`''` vs `"0,18 40,10 80,2"`, `[]` vs `[2,3,4,5]`, `'flat'` vs `'up'`, missing aria-label names). Semantic assessment: valid RED.
- `gsd_run check tdd-red-evidence` was not run: `workflow.tdd_mode` is not enabled in `.planning/config.json` and the gsd-tools CLI is not present in the worktree. The assessment above is manual.
- RED (`test(01-10)`) precedes GREEN (`feat(01-10)`) for both tasks.

## Decisions Made
See `key-decisions` in frontmatter. Notable: panel stays a controlled component (selected state lives with the caller) while still handling the keyboard model, and an optional `className` prop was added for placement.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Test scoping] Task 1 "missing price" test asserts one dash, Day % dash moved to Task 2**
- **Found during:** Task 1 GREEN
- **Issue:** The Task 1 test first required two muted dashes (Price and Day %), but the Day % cell is Task 2 scope, so it could not pass without pulling Task 2 work forward and making Task 2's RED an unexpected green.
- **Fix:** Task 1 test requires at least one muted dash (the price); the two-dash assertion for Price and Day % lives in Task 2's "muted dash, never 0" test.
- **Files modified:** frontend/src/__tests__/WatchlistPanel.test.tsx
- **Committed in:** 212a5fbb

**2. [Rule 1 - Acceptance criterion] Removed the string "aria-live" from a PriceCell comment**
- **Found during:** Task 1 acceptance check
- **Issue:** `! grep -q 'aria-live' PriceCell.tsx` matched a comment that explained why there is no live region.
- **Fix:** Reworded the comment; behavior unchanged and a test asserts no `[aria-live]` element renders.
- **Files modified:** frontend/src/components/PriceCell.tsx
- **Committed in:** 212a5fbb

---

**Total deviations:** 2 auto-fixed (test scoping, comment wording)
**Impact on plan:** None on behavior or scope.

## Issues Encountered
- Each `git commit` printed `failed to delete .../.git/worktrees/agent-*: Permission denied` from automatic worktree pruning of other agents' (sibling) worktree metadata on Windows; commits succeeded and no files of this plan were affected.
- Line-ending warnings (LF to CRLF) from git on Windows are cosmetic.

## Known Stubs
None. The RED-step API-surface stubs were all replaced with real implementations in the GREEN commits.

## Threat Flags
None. Ticker text is rendered only as React text and attributes (T-01-15); no new network surface (the hook reuses `fetchWatchlist`).

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Plan 01-12 can mount `useWatchlist()` + `<WatchlistPanel {...watchlist} selected onSelect className />` in `AppShell` (this plan did not touch AppShell or the backend) and own the selected ticker (default first entry per D-15).
- Not done here by design: the UI-SPEC's client-side Day % recomputation between SSE ticks and the debounced refetch for null `day_change_percent`; the plan scopes Day % to the SSE `day_change_percent` with REST fallback (OQ-2 resolution).
- Real-browser check of flash fade and density is pending until the panel is wired into the page.

## Self-Check: PASSED

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*
