---
phase: 01-live-market-terminal
plan: 14
subsystem: ui
tags: [lightweight-charts, react, nextjs, tailwind, vitest, docker]

requires:
  - phase: 01-live-market-terminal
    provides: "01-05 priceStore (getTicks, onTick, usePriceStream, session stats)"
  - phase: 01-live-market-terminal
    provides: "01-12 AppShell selected-ticker state and the inline CHART panel"
  - phase: 01-live-market-terminal
    provides: "01-13 scripts/start_mac.sh with FINALLY_CONTAINER / FINALLY_VOLUME / FINALLY_PORT"
provides:
  - "Main chart: Lightweight Charts v5 area series for the selected ticker, fed from the price store"
  - "40px chart strip: live price, change since page load, session H and L"
  - "Waiting and no-selection overlays; chart dims to 0.5 opacity while the stream is not open"
  - "Rebuilt finally-phase1-test container serving the finished page on 127.0.0.1:8000, left running"
affects: [phase-2-trading, phase-2-pnl-chart, end-of-phase-human-check]

plan_head_before: f43334222dacebab249e79c24a58987adb4cf077
plan_head_after: 7472bcf9bc416b5670c057ef05857d80023e5bb4
actuals:
  tokens: 9500
  tasks: 2
  commits: 4

tech-stack:
  added: []
  patterns:
    - "Imperative chart wrapper: chart + series created once in an empty-deps effect, data/subscription in a ticker-keyed effect"
    - "Client-only canvas via next/dynamic ssr:false in a 'use client' loader module"
    - "Live ticks go through series.update only; setData and fitContent run once per ticker switch"

key-files:
  created:
    - frontend/src/lib/chartData.ts
    - frontend/src/components/ChartStrip.tsx
    - frontend/src/components/MainChartPanel.tsx
    - frontend/src/components/ChartCanvas.tsx
    - frontend/src/components/ChartClient.tsx
    - frontend/src/__tests__/chartData.test.ts
    - frontend/src/__tests__/MainChartPanel.test.tsx
    - frontend/src/__tests__/ChartCanvas.test.tsx
  modified:
    - frontend/src/components/AppShell.tsx
    - frontend/src/__tests__/AppShell.test.tsx

key-decisions:
  - "ChartCanvas tests mock the price store module (getTicks/onTick) as well as lightweight-charts, because the real store already drops out-of-order timestamps and the 'earlier second is ignored' guard would otherwise be unreachable"
  - "Waiting overlay is driven by snapshot.session[ticker] being absent (equivalent to an empty buffer since the first accepted tick creates both)"
  - "Panel layout classes moved from AppShell into MainChartPanel so the layout is unchanged while AppShell just renders <MainChartPanel ticker={selected} />"

patterns-established:
  - "Stub-then-test RED: compile-only stub modules so RED fails on assertions instead of unresolved imports"
  - "Tests that mount AppShell stub @/components/ChartClient (jsdom has no canvas)"

requirements-completed: [UI-04]

coverage:
  - id: D1
    description: "Clicking a watchlist ticker or moving the selection shows it in the main chart; panel title reads CHART · TICKER with the ticker in the accent color"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/MainChartPanel.test.tsx#titles the panel CHART · AAPL with the ticker in the accent class"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/AppShell.test.tsx#selects a clicked row and retitles the chart"
        status: pass
    human_judgment: false
  - id: D2
    description: "Stats strip shows live price, change since page load colored by sign, session H and L, dashes before the first tick"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/MainChartPanel.test.tsx#shows the live price, change since page load, and session high and low"
        status: pass
    human_judgment: false
  - id: D3
    description: "One Lightweight Charts v5 area series (#209dd7, gradient, crosshair) created once, setData+fitContent once per ticker switch, live ticks via update, second-collapsing, removal on unmount"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/ChartCanvas.test.tsx"
        status: pass
      - kind: unit
        ref: "frontend/src/__tests__/chartData.test.ts"
        status: pass
      - kind: other
        ref: "npm --prefix frontend run build (static export prerenders without canvas errors)"
        status: pass
    human_judgment: false
  - id: D4
    description: "Waiting, no-selection and dimmed-while-offline states"
    requirement: UI-04
    verification:
      - kind: unit
        ref: "frontend/src/__tests__/MainChartPanel.test.tsx#MainChartPanel chart canvas"
        status: pass
    human_judgment: false
  - id: D5
    description: "Rebuilt container serves the complete page with live SSE data; real-browser chart appearance (area line, crosshair, scroll/zoom not reset, dim on docker stop)"
    verification:
      - kind: other
        ref: "start_mac.sh --build; /api/health ok; GET / contains FinAlly; SSE data line contains AAPL; finally-data volume intact"
        status: pass
    human_judgment: true
    rationale: "Canvas rendering, crosshair feel, zoom/scroll persistence and the offline dimming are visual and interactive; no automated test asserts them in a real browser (end-of-phase human check)"
  - id: D6
    description: "Long-session behavior: after 50,000 buffered ticks per ticker the oldest are dropped and the chart still updates without lag (backstop)"
    verification: []
    human_judgment: true
    rationale: "Held-out backstop: buffer cap is covered by the priceStore tests (plan 01-05) and the chart only appends via update, but no test measures chart lag at 50,000 points"

duration: 14min
completed: 2026-10-20
status: complete
---

# Phase 1 Plan 14: Main Chart Summary

**Lightweight Charts v5 area chart for the selected ticker with a live price / change-since-load / H-L strip, waiting and dimmed-offline states, and the rebuilt test container serving the finished page**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-10-20T22:46:00Z (approx.)
- **Completed:** 2026-10-20T23:00:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 10 (8 created, 2 modified)

## Accomplishments

- `lib/chartData.ts`: `toChartTime` (floor to integer seconds) and `collapseBySecond` (latest price per second, strictly ascending, earlier seconds dropped).
- `ChartStrip` (40px) and `MainChartPanel`: title `CHART · TICKER` (ticker in accent), live price at display size with no flash class, `+1.24 (+0.65%)` style change colored by sign, session `H`/`L`, dashes before the first tick, `Waiting for the first price…` and `Select a ticker to see its chart.` overlays. AppShell now renders `<MainChartPanel ticker={selected} />`.
- `ChartCanvas` + `ChartClient`: one `createChart` per mount with the UI-SPEC options, a single `addSeries(AreaSeries, ...)` (#209dd7 line, soft blue gradient, dashed crosshair, price precision 2), `setData` + `fitContent` exactly once per ticker switch, `series.update` for live ticks (guarded against earlier seconds), `chart.remove()` and unsubscribe on unmount, opacity 0.5 when the stream is not open. The loader uses `next/dynamic` with `ssr: false` so the static export never imports canvas code.
- Rebuilt the image through `scripts/start_mac.sh --build` with `FINALLY_CONTAINER=finally-phase1-test FINALLY_VOLUME=finally-data-phase1-test FINALLY_PORT=8000`; the container is healthy and left running for the end-of-phase human check. `finally-data` was never mounted and still exists.

## Task Commits

1. **Task 1: chart panel follows the selected ticker** - RED `03fa92e2` (test), GREEN `54ab1c04` (feat)
2. **Task 2: live blue area chart + rebuilt container** - RED `4ff2e3b3` (test), GREEN `7472bcf9` (feat)

No REFACTOR commits (nothing to clean up). **Plan metadata:** the docs commit that adds this SUMMARY follows.

## TDD Gate Compliance

Both tasks have a `test(01-14)` commit before their `feat(01-14)` commit.

- **RED evidence, Task 1:** `npm --prefix frontend test -- src/__tests__/chartData.test.ts src/__tests__/MainChartPanel.test.tsx` -> 11 failed, 1 passed (the `[] -> []` case). Failures were assertion errors on the planned behavior, e.g. `expected 1791100800.92 to be 1791100800` and `expected 'CHART' to be 'CHART · AAPL'`. Semantic assessment: the target tests executed and failed on the intended assertions; no import, syntax or fixture faults after compile-only stubs were added.
- **RED evidence, Task 2:** `ChartCanvas.test.tsx` + `MainChartPanel.test.tsx` -> 10 failed, 10 passed, e.g. `expected "vi.fn()" to be called 1 times, but got 0 times` (createChart/remove/fitContent) and `Unable to find an element by: [data-testid="chart-client"]`. The 10 that passed are negative cases (no update for another ticker, no canvas without a ticker, etc.) that hold trivially against a stub; the positive behaviors all failed first. `gsd_run check tdd-red-evidence` was not run (TDD gate mode is not enabled for this phase and the records were not persisted to JSON); the assessment above is by inspection of the Vitest output.
- **GREEN:** full frontend suite 163 passed after Task 2; typecheck clean.

## Files Created/Modified

- `frontend/src/lib/chartData.ts` - `toChartTime`, `collapseBySecond`, `ChartPoint`
- `frontend/src/components/ChartStrip.tsx` - ticker, live price, change since load, session H/L
- `frontend/src/components/MainChartPanel.tsx` - panel chrome, strip, canvas slot, overlays, dimming flag
- `frontend/src/components/ChartCanvas.tsx` - imperative Lightweight Charts v5 wrapper (default export)
- `frontend/src/components/ChartClient.tsx` - `next/dynamic(..., { ssr: false })` loader
- `frontend/src/components/AppShell.tsx` - inline CHART panel replaced by `MainChartPanel`
- `frontend/src/__tests__/chartData.test.ts`, `MainChartPanel.test.tsx`, `ChartCanvas.test.tsx` - new tests
- `frontend/src/__tests__/AppShell.test.tsx` - stale expectation updated, `ChartClient` stubbed

## Decisions Made

- Mocked the price store in `ChartCanvas.test.tsx` (besides `lightweight-charts`) so the "tick earlier than the last charted second is ignored" guard can be exercised; the real store already rejects non-newer timestamps.
- Used `snapshot.session[ticker]` presence for the waiting overlay (same condition as an empty buffer).
- Kept the panel's responsive layout classes unchanged by moving them into `MainChartPanel`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Compile-only stubs in the RED commits**
- **Found during:** Task 1 and Task 2 RED
- **Issue:** With no source modules, the tests failed on unresolved imports (load failure), which is INVALID_RED per tdd.md.
- **Fix:** Added minimal stubs (wrong-behavior `chartData.ts`/`MainChartPanel.tsx`; empty `ChartCanvas.tsx`/`ChartClient.tsx`) in the RED commits so the tests fail on assertions.
- **Files modified:** the four stub files above (replaced in the GREEN commits)
- **Committed in:** `03fa92e2`, `4ff2e3b3`

**2. [Rule 1 - Bug] Stale AppShell test expectation**
- **Found during:** Task 1 GREEN
- **Issue:** `AppShell.test.tsx` expected "Select a ticker to see its chart." with AAPL selected (true only for the 01-12 placeholder); the chart now shows `Waiting for the first price…` in that state.
- **Fix:** Updated that single expectation.
- **Files modified:** `frontend/src/__tests__/AppShell.test.tsx`
- **Committed in:** `54ab1c04`

**3. [Rule 1 - Bug] Flaky unhandled "Value is null" error in AppShell tests**
- **Found during:** Task 2 GREEN
- **Issue:** Once `MainChartPanel` mounted the real dynamic canvas, AppShell tests sometimes resolved the import and ran real `createChart` in jsdom (no canvas context), producing an unhandled error.
- **Fix:** `vi.mock("@/components/ChartClient", ...)` returning null in `AppShell.test.tsx`.
- **Files modified:** `frontend/src/__tests__/AppShell.test.tsx`
- **Committed in:** `7472bcf9`

**4. [Rule 1 - Bug] Test typing**
- **Found during:** Task 2 typecheck
- **Issue:** `vi.fn(() => chart)` infers an empty tuple, so `mock.calls[0][1]` failed `tsc` (and would fail `next build` type checking over test files).
- **Fix:** Typed the fake `createChart`/`addSeries` parameters.
- **Committed in:** `7472bcf9`

---

**Total deviations:** 4 auto-fixed (1 blocking, 3 bugs). **Impact on plan:** none on scope; all in test scaffolding.

## Issues Encountered

- `cd backend && uv run --no-sync pytest -q` fails to collect in this fresh worktree (no `backend/.venv`, so uv picked an interpreter without dataclass `slots`). The same suite run with the main checkout's venv interpreter against this worktree's `backend/` passed: **171 passed**. The backend is untouched by this plan.
- The worktree has no repo-root `.env` (gitignored), so `start_mac.sh` printed its documented warning and started the container without it. Prices and SSE use the simulator, so the page is complete; only AI chat (not part of this phase's check) would return `llm_error`. `.env` was never read.
- Git printed `failed to delete ... .git/worktrees/agent-...: Permission denied` after each commit (housekeeping for other agents' worktree metadata). Commits succeeded.

## Verification Results

- `npm --prefix frontend test`: 13 files, 163 tests passed.
- `npm --prefix frontend run typecheck`: clean. `npm --prefix frontend run build`: success, `frontend/out/index.html` present.
- Acceptance greps: `addSeries(AreaSeries`, `fitContent`, `ssr: false` present; `addAreaSeries` absent; `lightweight-charts` the only chart dependency.
- Container: `/api/health` -> `{"status":"ok"}`; `GET /` contains `FinAlly`; SSE `data:` line contains `"AAPL"`; `docker volume inspect finally-data` succeeds; container `finally-phase1-test` is `Up (healthy)` on `127.0.0.1:8000`.

## Human Check (end-of-phase, container left running)

Container `finally-phase1-test` (volume `finally-data-phase1-test`) is running at http://localhost:8000. Confirm:

1. Dark terminal page; header shows FinAlly with "Ally" in yellow, TOTAL VALUE $10,000.00 (neutral, no flashing), CASH $10,000.00, green dot labeled LIVE.
2. Watchlist lists AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX; prices update about every 500ms; only the price cell flashes green/red and fades within about half a second; small up/down triangle follows each price; Day % is green/red by sign; sparklines start flat and fill in.
3. AAPL is selected on load (yellow left bar) and the main chart shows a blue area line with the strip (price, change since load, H and L). Click MSFT: title, strip and chart switch. ArrowDown/ArrowUp: selection and chart follow. Hover: dashed crosshair with a price label; scroll and zoom work and are not reset by new ticks.
4. `FINALLY_CONTAINER=finally-phase1-test bash scripts/stop_mac.sh` (or `docker stop finally-phase1-test`): within seconds the dot turns yellow RECONNECTING then red OFFLINE, prices turn gray, flashing stops and the chart dims. Start again with the same start-script command (`MSYS_NO_PATHCONV=1 FINALLY_CONTAINER=finally-phase1-test FINALLY_VOLUME=finally-data-phase1-test FINALLY_PORT=8000 bash scripts/start_mac.sh`): the dot returns to green LIVE.
5. Narrow the window below 1200px: panels stack in one column and the AI chat panel is collapsed behind "Show chat".
6. TRADE, HEATMAP, P&L, POSITIONS and AI CHAT show their "coming soon" or empty-state text.

Note: the image was built from this worktree, so it contains plans 01-01 through 01-14 only. Live Massive prices need a paid key and are not part of the check. The user's own `finally-data` volume is untouched.

## Known Stubs

None. The AI CHAT, TRADE, HEATMAP, P&L and POSITIONS panels still render their intentional "coming soon" placeholders by design (later phases); they were not touched by this plan.

## Threat Flags

None. No new endpoints or trust boundaries. T-01-22 mitigations: 50,000-point buffer cap (plan 01-05), per-second collapse, `series.update` per tick. T-01-23: the test container is published on 127.0.0.1 only and uses the separate test volume; stop it with `FINALLY_CONTAINER=finally-phase1-test bash scripts/stop_mac.sh`.

## Next Phase Readiness

- Phase 1 plan set is complete once the orchestrator merges this worktree; the end-of-phase human check items above are queued against the running container.
- The P&L chart in Phase 2 can reuse the Lightweight Charts dependency; do not add a second charting library.

---
*Phase: 01-live-market-terminal*
*Completed: 2026-10-20*

## Self-Check: PASSED

- Created files present: chartData.ts, ChartStrip.tsx, MainChartPanel.tsx, ChartCanvas.tsx, ChartClient.tsx, chartData.test.ts, MainChartPanel.test.tsx, ChartCanvas.test.tsx.
- Commits `03fa92e2`, `54ab1c04`, `4ff2e3b3`, `7472bcf9` are ancestors of HEAD (4 commits since base f4333422).
