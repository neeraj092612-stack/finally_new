# Phase 1: Live Market Terminal - Research

**Researched:** 2026-10-20
**Domain:** FastAPI + SQLite lifespan wiring, GBM/Massive market-data fixes, Next.js 16 static export + Tailwind v4 + Lightweight Charts v5 terminal UI, multi-stage Docker, Windows/macOS start scripts
**Confidence:** HIGH (stack and Docker path were built and run end-to-end in a spike this session); MEDIUM on Massive live behaviour (no API key available to test)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Page layout & panels**
- **D-01:** Desktop layout is a 3-column grid: watchlist in the left column (trade bar slot beneath it); center column has the main chart on top, then heatmap and P&L chart side by side, then the positions table; AI chat docked in the right column; header spans the full width on top.
- **D-02:** Build the final grid now. Panels not delivered in Phase 1 (positions, heatmap, P&L chart, trade bar, chat) render as titled placeholders with empty states (e.g. "No positions yet", "Chat — coming soon"), so the layout does not shift in later phases.
- **D-03:** Panel chrome is terminal-style: small uppercase title bar per panel (e.g. `WATCHLIST`, `CHART · AAPL`), 1px muted gray borders, tight padding, no rounded cards or shadows.
- **D-04:** Below desktop width (tablet), columns stack vertically and the chat panel is collapsible. Functional, not optimized.

**Price flash & tick feedback**
- **D-05:** On each price change, only the price cell flashes: brief green (up) or red (down) background tint fading over ~500ms via CSS transition.
- **D-06:** Fix flat-direction ticks in the backend: compute `direction` (and `change`/`change_percent`) from the unrounded price, reporting `"flat"` only when the price truly did not change. Displayed/serialized prices remain 2 dp per the SSE contract. — **Reversibility:** reversible — internal to `PriceCache`/`PriceUpdate`; covered by existing market tests that must be updated.
- **D-07:** Each watchlist row shows a small green ▲ / red ▼ next to the price for the last tick direction.
- **D-08:** The header total value does not flash; it updates quietly and is colored by overall P&L versus the $10,000 start (green above, red below, neutral at par).

**Watchlist rows**
- **D-09:** Single dense line per ticker, columns in order: Ticker · Sparkline · Price (+ ▲/▼) · Day %.
- **D-10:** Sparklines show a rolling window of the last ~5 minutes (~600 ticks at 500ms), hand-rolled SVG polylines.
- **D-11:** Sparkline stroke is green if the last point is above the first point in the window, red if below.
- **D-12:** The ticker shown in the main chart is marked with a yellow (`#ecad0a`) left accent bar plus a subtle lighter row background. Clicking a row selects it.
- **D-13:** Day % is colored green/red by sign. Rows with no price yet show placeholders (e.g. `—`) rather than zeros.

**Main chart**
- **D-14:** Lightweight Charts area series: blue (`#209dd7`) line with a soft gradient fill, built from raw SSE ticks accumulated since page load for the selected ticker.
- **D-15:** On load the selected ticker is the first watchlist entry (AAPL on a fresh install). Selection is not persisted.
- **D-16:** The chart panel title/strip shows ticker, live price, change since page load (abs and %), and session high/low; crosshair with price label on hover.
- **D-17:** Time axis keeps all ticks since page load and auto-fits to width; the user can scroll/zoom.

**Carried forward from PROJECT.md (locked, not re-discussed)**
- **D-18:** `day_change_percent` baseline = first price seen since server start (simulator); previous close in Massive mode.
- **D-19:** Connection dot maps `EventSource.readyState`: OPEN green, CONNECTING yellow, CLOSED red.
- **D-20:** Chart and sparkline history is browser-only; a page refresh empties it.
- **D-21:** DB init, market data start, and the startup portfolio snapshot run in the FastAPI lifespan; DB location from `DB_PATH` (default `db/finally.db`, `/app/db/finally.db` in Docker).
- **D-22:** Start scripts warn and run without `--env-file` if `.env` is missing; `.env.example` is committed.
- **D-23:** Write each §13.2 decision implemented in this phase back into `planning/PLAN.md`.

### Claude's Discretion
- Exact pixel sizes, fonts (a monospace/tabular-numeral font is expected for prices), and spacing within the "dense terminal" brief.
- Header contents beyond total value, cash and connection dot (e.g. app name/logo, unrealized P&L).
- Number formatting details (thousands separators, sign display).
- Start script output wording and how it detects an existing image/container.
- Frontend state management approach and component structure.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

**Also locked (approved UI-SPEC):** `.planning/phases/01-live-market-terminal/01-UI-SPEC.md` is an approved design contract (spacing, typography, colors, copy, component names). This research covers implementation only and does not re-decide design. Two places where an implementation fact interacts with it are flagged in Open Questions (OQ-1 flash rule vs D-06, OQ-2 Day % derivation).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MKT-01 | Massive snapshot parsing uses real `LastTrade` fields | `parse_snapshot()` pure function against real `TickerSnapshot.from_dict` models (verified to work, §Code Examples C-2); tests must use real models, not `MagicMock` |
| MKT-03 | SSE router created twice does not duplicate routes | Move `APIRouter(...)` inside `create_stream_router()` (§C-3); test asserts one `/api/stream/prices` route per router |
| MKT-04 | Simulator add-before-start not dropped | Pending-ticker queue in `SimulatorDataSource` (§C-4) |
| MKT-05 | `day_change_percent` baseline | `reference_price` stored on `PriceUpdate`; simulator = first price seen, Massive = `prev_day.close`; exposed as additive SSE fields (§C-1) |
| PLAT-01 | FastAPI lifespan: DB init, source start, startup snapshot | `create_app()` factory + lifespan order (§C-6); `app.main:create_app --factory` |
| PLAT-02 | `DB_PATH`, data persists | `Settings.from_env()`; named volume persistence verified in spike (boots counter went 1→2 across `docker stop`/`start`) |
| PLAT-03 | Fresh DB seeded (cash $10,000, 10 tickers) | Seed only when the profile row is newly inserted (§C-5), so a user-emptied watchlist is never re-seeded |
| PLAT-05 | `GET /api/health` | trivial `def` route; Docker `HEALTHCHECK` verified `healthy` |
| PLAT-06 | SSE mounted | `app.include_router(create_stream_router(cache))` before static mount |
| PLAT-07 | Static export at `/`, API first | `StaticFiles(directory, html=True)` mounted last, guarded by `is_dir()` (probe verified `/` → 200, `/api/health` → JSON) |
| PORT-01 | `GET /api/portfolio` | `build_portfolio(conn, cache)` pure function reused by startup snapshot (§C-7) |
| WATCH-01 | `GET /api/watchlist` | `watchlist_entry()` per MARKET_DATA_DESIGN §15.2; order `ORDER BY added_at, rowid` (§Pitfall 6) |
| UI-01 | Header + connection dot | Store + `ConnectionIndicator`; readyState semantics verified (§Pattern F-3) |
| UI-02 | Watchlist flash/sparkline/Day % | Store ingest rules, keyed-remount flash, SVG polyline (§F-2, F-4, F-5) |
| UI-04 | Click ticker → main chart | Lightweight Charts v5 `AreaSeries` imperative wrapper (§F-6) |
| DEP-01 | Multi-stage Dockerfile | Full Dockerfile built and run in spike (§C-9) |
| DEP-02 | `.env.example` | Names-only template; unquoted values (§C-10) |
| DEP-03 | Start/stop scripts | Bash + PowerShell patterns; PS 5.1 native-command behaviour verified (§C-11) |
</phase_requirements>

## Summary

Everything the phase needs can be built with the fixed stack; nothing exotic is required. The backend is a classic FastAPI app factory (`create_app()`), a stdlib `sqlite3` layer with short-lived per-call connections, and four small fixes to the existing `backend/app/market/` package. The frontend is a Next.js 16 static export with Tailwind v4 `@theme` tokens, `@fontsource/jetbrains-mono` (bundled into `_next/static/media`, no CDN), a single module-level `EventSource` store read through `useSyncExternalStore`, hand-rolled SVG sparklines, and one imperative Lightweight Charts v5 area series. I built a throwaway spike in the scratchpad that proves the non-obvious plumbing on this exact machine: Next 16.3.8 + Tailwind 4.3.3 + lightweight-charts 5.2.1 + fontsource static export builds locally (Node 24) **and** inside `node:20-slim` using a Windows-generated `package-lock.json`; Vitest 5 + RTL + jsdom runs; a python:3.12-slim + uv image serves the export, the SSE stream, `/api/health`, passes its `HEALTHCHECK`, and keeps SQLite data across `docker stop`/`start` on a named volume. Docker 29.7.2 is installed and the daemon is running.

Four findings change what the planner should write. (1) The simulator and `PriceCache` both round to 2 dp *before* direction is computed, so D-06 needs a three-file change (simulator `step()` stops rounding, `PriceUpdate` carries raw prices for direction/change, cache rounds only for display) plus updating the existing `test_prices_rounded_to_two_decimals`. (2) The Massive full-market-snapshot endpoint is documented as **not included in the free "Stocks Basic" plan** (Starter and above only), contradicting the PLAN's "free tier, poll every 15 s" assumption; Massive mode must fail soft and cannot be live-verified without a paid key. (3) `uvicorn` with an open SSE client does not exit on `docker stop` (exit 137 after ~5.5 s) unless started with `--timeout-graceful-shutdown`; with `2` it exits 0 in ~3.6 s. (4) The machine already has a stale `finally:latest` image and a `finally-data` volume containing an older `finally.db` from a previous attempt; "build if image missing" and "fresh DB" assumptions will silently be wrong here.

**Primary recommendation:** Build backend (market fixes → DB → app factory → routes) and frontend (store → panels → chart) in parallel waves, add `reference_price`/`day_change_percent` as additive SSE fields so the client never has to derive a baseline, run uvicorn as `app.main:create_app --factory --timeout-graceful-shutdown 2`, and verify every success criterion through the container.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Price generation (GBM / Massive poll) | API / Backend (in-process task) | — | Producers write only to `PriceCache`; consumers never call sources |
| Direction / change / day-change baseline | API / Backend (`PriceUpdate`/`PriceCache`) | Browser (display only) | D-06/D-18 are backend decisions; client trusts SSE fields |
| Price push | API / Backend (SSE router) | Browser (`EventSource`) | One-way push, native reconnect |
| Flash, ▲/▼ marker, sparkline, session H/L, chart history | Browser | — | D-20: history is browser-only; derived from SSE ticks since page load |
| Live header total value | Browser (cash + Σ qty × price) | API (`GET /api/portfolio` initial) | Positions empty in Phase 1, equals cash; recompute client-side per PROJECT decision |
| Portfolio/watchlist persistence | Database (SQLite file on named volume) | API | Lifespan-initialised, seeded once |
| Startup snapshot | API (lifespan) | Database | Needs DB + first prices |
| Static UI serving | API / Backend (`StaticFiles`) | — | Single origin/port; mounted after API routes |
| Connection status | Browser (`readyState`) | — | Pure client concept (D-19) |
| Image build / launch | Docker + scripts | — | Scripts are the only launch path |

## Standard Stack

### Core (frontend) — all versions exact-pinned and **built in the spike**
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.3.8 | App Router, `output: 'export'` | Fixed by PLAN §10; `engines.node >=20.9.0` [VERIFIED: npm view next engines] |
| react / react-dom | 19.3.0 | UI | Next 16 peer `^19.0.0` [VERIFIED: npm view next peerDependencies] |
| lightweight-charts | 5.2.1 | Main chart (canvas) | PLAN §10; `AreaSeries` exported, option names read in `dist/typings.d.ts` [VERIFIED: node_modules typings] |
| tailwindcss + @tailwindcss/postcss | 4.3.3 | CSS-first `@theme` tokens | UI-SPEC; `bg-bg`, `text-up`, `text-accent` utilities confirmed in built CSS [VERIFIED: spike build output] |
| postcss | 8.5.29 | Tailwind v4 PostCSS plugin host | Required by `@tailwindcss/postcss` |
| @fontsource/jetbrains-mono | 5.3.0 | Bundled mono font | UI-SPEC; woff/woff2 emitted to `_next/static/media` [VERIFIED: spike `out/`] |
| typescript | 5.9.3 | Type check in `next build` | Latest dist-tag is 7.0.2, **not tested with Next 16** — stay on 5.9.3 which the spike proved [VERIFIED: spike build] |

### Supporting (frontend dev/test)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | 5.0.1 | Unit tests | Requires Node `^22.12 \|\| ^24 \|\| >=26` — local only, never in the Docker Node 20 stage [VERIFIED: npm view vitest engines] |
| @vitejs/plugin-react | 6.1.2 | JSX in Vitest | — |
| jsdom | 30.1.3 | DOM env (needs Node `^22.22.2 \|\| ^24.15 \|\| >=26`; local is v24.21.0) | [VERIFIED: npm view jsdom engines; node --version] |
| @testing-library/react / jest-dom / user-event | 16.3.3 / 7.0.1 / 14.6.8 | Component tests | — |
| @types/react, @types/react-dom, @types/node | 19.3.0 / 19.3.0 / 22.20.5 | Types | — |

### Core (backend) — no new runtime packages
| Library | Version | Purpose | Note |
|---------|---------|---------|------|
| fastapi | 0.128.7 (locked) | App, routers, `StaticFiles` re-export | [VERIFIED: backend/uv.lock] |
| starlette | 0.52.1 (locked) | `StaticFiles`, `TestClient` | [VERIFIED: backend/uv.lock] |
| sqlite3 (stdlib) | Python 3.12 | DB | No `aiosqlite` — handlers are sync `def` routes (threadpool) |
| **httpx** | add to `dev` extra | `fastapi.testclient.TestClient` dependency | **Not in `uv.lock`** (grep found no `name = "httpx"`); it is only installed in the venv by accident. Add `httpx>=0.27` to `[project.optional-dependencies].dev` and run `uv lock` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `useSyncExternalStore` store | zustand / Redux | Extra dependency for a 10-ticker store; not worth it |
| Next 16.4.x / React 19.3.1 (latest) | 16.3.8 / 19.3.0 (chosen) | Latest were published 2–6 days ago; the legitimacy seam flags them `too-new`. 16.3.8 is ≥3 weeks old and proven here |
| TypeScript 7.0.2 | 5.9.3 | 7.x untested against Next 16 type-check; no benefit for this phase |
| Node 22 in Docker | Node 20 (PLAN/DEP-01) | Node 20 works (verified). Node 20 reached end-of-life in 2026 [ASSUMED]; keep 20 because DEP-01 locks it, optionally revisit |

**Installation:**
```bash
cd frontend
npm install --save-exact next@16.3.8 react@19.3.0 react-dom@19.3.0 lightweight-charts@5.2.1 @fontsource/jetbrains-mono@5.3.0
npm install --save-exact -D typescript@5.9.3 @types/react@19.3.0 @types/react-dom@19.3.0 @types/node@22.20.5 \
  tailwindcss@4.3.3 @tailwindcss/postcss@4.3.3 postcss@8.5.29 vitest@5.0.1 @vitejs/plugin-react@6.1.2 \
  jsdom@30.1.3 @testing-library/react@16.3.3 @testing-library/jest-dom@7.0.1 @testing-library/user-event@14.6.8
```
Commit `package-lock.json`; the Dockerfile uses `npm ci` (verified to work on Linux from a Windows-generated lockfile).

**Version verification:** every version above was resolved with `npm view` on 2026-10-20 and installed and built in `scratchpad/spike`. Dist-tags at that date: next 16.4.2, react 19.3.1, vitest 5.0.5, typescript 7.0.2, jsdom 30.1.3 [VERIFIED: npm registry].

## Package Legitimacy Audit

Run via `gsd-tools query package-legitimacy check --ecosystem npm ...` on 2026-10-20.

| Package | Registry | Latest publish | Downloads/wk | Source Repo | Verdict | Disposition |
|---------|----------|----------------|--------------|-------------|---------|-------------|
| tailwindcss, @tailwindcss/postcss | npm | 2026-07-16 | 84.7M / 28.7M | tailwindlabs/tailwindcss | OK | Approved |
| lightweight-charts | npm | 2026-08-12 | 784K | tradingview/lightweight-charts | OK | Approved |
| @fontsource/jetbrains-mono | npm | 2026-07-19 | 1.17M | fontsource/font-files | OK | Approved |
| @testing-library/react, jest-dom | npm | 2026-08 | 41.6M / 42.7M | testing-library/* | OK | Approved |
| typescript, @types/react, @types/react-dom | npm | 2026-07/09 | 184M / 106M / 91M | microsoft / DefinitelyTyped | OK | Approved |
| next | npm | 2026-10-15 | 41.1M | vercel/next.js | SUS (`too-new`) | Flagged — see note |
| react, react-dom | npm | 2026-10-14 | 116M / 109M | react/react | SUS (`too-new`) | Flagged — see note |
| postcss | npm | 2026-10-18 | 188.6M | postcss/postcss | SUS (`too-new`) | Flagged — see note |
| vitest, @vitejs/plugin-react, jsdom, @testing-library/user-event, @types/node | npm | 2026-10 | 77.5M / 59.8M / 68.0M / 34.1M / 276.8M | official repos | SUS (`too-new`) | Flagged — see note |

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged [SUS]:** next, react, react-dom, postcss, vitest, @vitejs/plugin-react, jsdom, @testing-library/user-event, @types/node. The only reason code is `too-new` (the seam looks at the publish date of the *latest* version; the packages themselves are multi-year, tens-of-millions-per-week, with source repos and no postinstall scripts). Mitigation already applied: the recommended pins are older, proven versions (`next` 16.3.8 from 2026-09-30, `react` 19.3.0 from 2026-09-09, `vitest` 5.0.1 from 2026-09-15, etc.) installed with exact versions and a committed lockfile. **Planner: add ONE consolidated `checkpoint:human-verify` task ("review `package-lock.json` diff / confirm pins") before `npm install`, not one per package.** All these names were also confirmed through Context7/official docs (Next, Tailwind, Lightweight Charts) and `npm view` on the correct registry, but per protocol the legitimacy verdict, not registry existence, governs the tag. Python: no new runtime packages; `httpx` (dev) is already a transitive dependency of FastAPI's `TestClient` and is a long-established package [ASSUMED — pypi seam returns `unknown-downloads` for every package, so it cannot discriminate; `httpx` is already installed in `backend/.venv`].

## Architecture Patterns

### System Architecture Diagram

```
 Browser (single page)                                   Docker container :8000
┌────────────────────────────────────┐        ┌──────────────────────────────────────────────┐
│ priceStore (module singleton)      │        │ uvicorn (1 worker) -> create_app()           │
│  EventSource('/api/stream/prices') │◄──SSE──│  /api/stream/prices  (router per app)        │
│   onopen/onerror -> conn state     │ 500ms  │        ▲ reads                               │
│   ingest(): dedupe by timestamp    │        │  PriceCache  (version counter, raw+rounded)  │
│    ├ tick buffers (cap 50k)        │        │        ▲ writes                              │
│    ├ session first/hi/lo           │        │  MarketDataSource (Simulator | Massive)      │
│    └ flash seq / marker dir        │        │        ▲ start(watchlist) after DB init      │
│ useSyncExternalStore -> panels     │        │ lifespan: init_db -> read tickers -> start   │
│  Header ── Watchlist ── Chart      │        │           -> startup snapshot -> yield       │
│ fetch /api/portfolio, /api/watchlist──REST─►│  /api/health /api/portfolio /api/watchlist   │
│ Lightweight Charts (client-only)   │        │  (sync `def` routes, per-call sqlite conn)   │
└────────────────────────────────────┘        │ StaticFiles('/', html=True)  <- LAST         │
                                              │   serves Next export (index.html, _next/...) │
                                              │ SQLite  /app/db/finally.db  (volume          │
                                              │   finally-data), WAL                         │
                                              └──────────────────────────────────────────────┘
 start_*.sh / start_windows.ps1 -> docker build (if needed) -> docker run -d --name finally-app
```

### Recommended Project Structure
```
backend/
  app/
    main.py              # create_app(settings=None); lifespan; static mount last
    config.py            # Settings.from_env(): db_path, static_dir
    errors.py            # ApiError + envelope handlers (see Pattern B-6)
    db/__init__.py       # connect(), init_db(), now_iso(), USER_ID
    db/schema.py         # SCHEMA_SQL constant (PLAN §7), DEFAULT_TICKERS
    services/portfolio.py# build_portfolio(), record_snapshot()
    services/watchlist.py# list_entries(), watchlist_entry()
    api/health.py  api/portfolio.py  api/watchlist.py   # create_*_router()
    market/              # existing; edited per C-1..C-4
  tests/{api,db,services,market}/
frontend/
  app/{layout.tsx,page.tsx,globals.css}
  src/lib/{priceStore.ts,format.ts,api.ts,types.ts}
  src/components/{AppShell,Header,ConnectionIndicator,Panel,PlaceholderPanel,
                  WatchlistPanel,WatchlistRow,PriceCell,Sparkline,
                  MainChartPanel,ChartStrip,ChartCanvas,ChartClient}.tsx
  src/__tests__/*.test.tsx   (or colocated)
  next.config.ts postcss.config.mjs tsconfig.json vitest.config.mts vitest.setup.ts
Dockerfile  .dockerignore  .gitattributes  .env.example
scripts/{start_mac.sh,stop_mac.sh,start_windows.ps1,stop_windows.ps1}
db/.gitkeep
```
`backend/app/db/` (an importable package under `app`, matching hatch `packages = ["app"]`) is recommended over PLAN §4's `backend/db/`; write the choice back to PLAN §4 (D-23). The empty directories `backend/app/{api,db,llm,services}` and `backend/tests/{api,db,llm,services}` already exist in the working tree (untracked, no files). Layout for `frontend/` uses root `app/` + `src/` with alias `@/* -> ./src/*`, exactly as built in the spike.

### Suggested plan slicing (planner's call)
1. **Market fixes + tests** (C-1..C-4; backend only; update 2–3 existing tests).
2. **DB + app factory + REST + static + health** (C-5..C-8; depends on 1 only for `PriceUpdate` fields).
3. **Frontend scaffold + store + shell/placeholders** (parallel with 2; no backend needed — use a fake `EventSource` in tests).
4. **Watchlist/Header/Chart panels** (depends on 3).
5. **Docker + `.env.example` + scripts + `.dockerignore` + PLAN write-back + container verification** (depends on 2 and 4).

### Pattern B-1 (C-1): Raw-price direction + day-change baseline (MKT-05, D-06)
**What:** `PriceUpdate` keeps `price`/`previous_price` rounded to 2 dp (wire contract), adds `reference_price`, plus two *unrounded* fields used only for `change`/`change_percent`/`direction`. `PriceCache.update()` stores raw values and rounds for display. `GBMSimulator.step()` must stop rounding (current line is `result[ticker] = round(self._prices[ticker], 2)`), otherwise the cache only ever sees rounded numbers and D-06 is a no-op for the simulator.

**Why all three files:** the verified current code is `previous_price = prev.price if prev else price` with `price=round(price, 2), previous_price=round(previous_price, 2)` in `cache.py`, and `direction` compares the two rounded fields in `models.py` [VERIFIED: backend/app/market/cache.py:31-39, models.py:30-37, simulator.py:116]. Estimated per-tick move for AAPL is ~1.2 cents (σ 0.22, dt 8.48e-8, price 190), so a large share of ticks are flat after rounding [CITED: .planning/codebase/CONCERNS.md; arithmetic reproduced].

```python
# models.py — additive; every existing PriceUpdate(ticker, price, previous_price, timestamp) call still works
@dataclass(frozen=True, slots=True)
class PriceUpdate:
    ticker: str
    price: float                 # rounded, 2 dp (wire)
    previous_price: float        # rounded, 2 dp (wire)
    timestamp: float = field(default_factory=time.time)
    reference_price: float | None = None     # day-change baseline (2 dp)
    raw_price: float | None = None           # unrounded; direction/change only
    raw_previous_price: float | None = None

    def _cur(self) -> float:  return self.price if self.raw_price is None else self.raw_price
    def _prev(self) -> float: return self.previous_price if self.raw_previous_price is None else self.raw_previous_price

    @property
    def change(self) -> float:           return round(self._cur() - self._prev(), 4)
    @property
    def change_percent(self) -> float:   # guard 0 as today
        p = self._prev()
        return 0.0 if p == 0 else round((self._cur() - p) / p * 100, 4)
    @property
    def direction(self) -> str:
        c, p = self._cur(), self._prev()
        return "up" if c > p else "down" if c < p else "flat"
    @property
    def day_change_percent(self) -> float | None:
        return None if not self.reference_price else round((self.price - self.reference_price) / self.reference_price * 100, 2)

    def to_dict(self) -> dict:   # existing 7 keys + 2 additive keys; raw_* never serialized
        ...  # + "reference_price": self.reference_price, "day_change_percent": self.day_change_percent
```
```python
# cache.py — update()
with self._lock:
    ts = time.time() if timestamp is None else timestamp     # also fixes G9 (timestamp 0.0)
    prev = self._prices.get(ticker)
    prev_raw = prev.raw_price if prev and prev.raw_price is not None else (prev.price if prev else price)
    if reference_price is None:
        reference_price = prev.reference_price if prev else price      # simulator: first price seen
    update = PriceUpdate(ticker=ticker, price=round(price, 2), previous_price=round(prev_raw, 2),
                         timestamp=ts, reference_price=round(reference_price, 2) if reference_price else None,
                         raw_price=price, raw_previous_price=prev_raw)
    ...
```
Read `version` under the lock and bump it in `remove()` only if something was removed (design §6.1; both low-risk). Existing tests to update: `test_simulator.py::test_prices_rounded_to_two_decimals` (move the rounding assertion to the cache: `cache.update("X", 190.1234).price == 190.12`); add: `direction == "up"` when raw moves 190.001→190.003 while both display 190.00; first update flat; `reference_price` carried across updates; explicit `reference_price` wins (Massive).

**Wire additions (recommended, additive):** `reference_price`, `day_change_percent`. This matches the unapplied design in `planning/MARKET_DATA_DESIGN.md` §5/§12 and breaks nothing (PLAN §8 says the SSE shape is "already implemented"; extra keys are ignored by consumers). See OQ-2.

### Pattern B-2 (C-4): Simulator pending queue (MKT-04)
Current behaviour [VERIFIED: simulator.py:242-249]: `async def add_ticker(...)`: `if self._sim:` … nothing otherwise, and `get_tickers()` returns `[]` before start.
```python
class SimulatorDataSource(MarketDataSource):
    def __init__(...): ...; self._pending: list[str] = []

    async def start(self, tickers):
        merged = list(dict.fromkeys([*tickers, *self._pending]))   # order-preserving de-dupe
        self._pending = []
        self._sim = GBMSimulator(tickers=merged, event_probability=self._event_prob)
        for t in merged:
            price = self._sim.get_price(t)
            if price is not None: self._cache.update(ticker=t, price=price)   # first update fixes reference_price
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")

    async def add_ticker(self, ticker):
        if self._sim is None:
            if ticker not in self._pending: self._pending.append(ticker); logger.info(...)
            return
        if ticker in self._sim.get_tickers(): return        # avoid a spurious flat tick on idempotent re-add
        self._sim.add_ticker(ticker); ... cache.update(...)
    async def remove_ticker(self, ticker):
        self._pending = [t for t in self._pending if t != ticker]
        ...
    def get_tickers(self): return self._sim.get_tickers() if self._sim else list(self._pending)
```
Test: `add_ticker("PYPL")` then `start(["AAPL"])` → `cache.get("PYPL") is not None`.

### Pattern B-3 (C-3): Router factory (MKT-03)
Verified defect [VERIFIED: stream.py:17,26]: `router = APIRouter(prefix="/api/stream", tags=["streaming"])` at module level and `@router.get("/prices")` inside the factory. Fix: create the `APIRouter` inside `create_stream_router()`. Rename `_generate_events` → `generate_events` so tests can drive it with a fake request. Optional (G7, not a Phase-1 requirement): `: keep-alive` comment every 15 s. Test: `r1 = create_stream_router(c); r2 = create_stream_router(c)`; `assert r1 is not r2`; `[x.path for x in r1.routes] == ["/api/stream/prices"]` and same for `r2`. **Do not test the endpoint through `TestClient`** — the stream is infinite and the client blocks; call `generate_events(cache, FakeRequest())` with a request whose `is_disconnected()` returns True after N polls.

### Pattern B-4 (C-2): Massive parsing (MKT-01, MKT-05)
Verified defect [VERIFIED: massive_client.py:100-103]: `price = snap.last_trade.price` and `timestamp = snap.last_trade.timestamp / 1000.0`. Real model [VERIFIED: massive/rest/models/trades.py:27-57 and snapshot.py `TickerSnapshot`]: `LastTrade.from_dict` maps JSON `"t"` → `sip_timestamp`, there is no `timestamp` attribute; `Agg.close` from `"c"`; `TickerSnapshot` has `prev_day`, `min`, `day`, `last_trade`, `updated`. I executed `TickerSnapshot.from_dict(raw)` this session and obtained `AAPL 191.24 1791100800120000000 190.0 1791100800120000000 191.22 False` (ticker, price, sip_timestamp, prev_day.close, updated, min.close, `hasattr(last_trade,'timestamp')`). Implement `parse_snapshot()` exactly as in `planning/MARKET_DATA_DESIGN.md` §10.2 (price from `last_trade.price` → `min.close` → `day.close` → `prev_day.close`; timestamp `sip_timestamp/1e9` → `updated/1e9` → `time.time()`; `reference = prev_day.close`), pass `reference_price=` to `cache.update`, and apply the in-flight-removal filter (G3 is Phase 2/MKT-02, but the filter is three lines and free). `updated`'s unit is nanoseconds per the design doc; the official docs page shows a 19-digit sample and does not state the unit [CITED: massive.com full-market-snapshot docs — inference only], so treat it as a fallback only.

**Tests must build snapshots with `TickerSnapshot.from_dict(...)`**, never `MagicMock` (that is exactly how G1 passed 73 tests). Existing `test_massive.py::_make_snapshot` must be rewritten.

**Massive free-tier caveat (HIGH impact on criterion 5, last sentence):** the official docs state the Stocks full-market snapshot endpoint is available on Starter/Developer (15-min delayed) and Advanced/Business (real-time) and **not on Stocks Basic**; snapshot data is cleared daily at 3:30 AM EST and repopulates from ~4:00 AM EST [CITED: massive.com/docs/rest/stocks/snapshots/full-market-snapshot — page summarised by a small model]. A free key will therefore likely produce auth errors on every poll. The backend must keep running with an empty cache (log with backoff, redact the key), and the "real prices" criterion can only be proven manually with a paid key. Parsing correctness is proven by the real-model unit tests. See OQ-3.

### Pattern B-5 (C-5/C-6/C-7): SQLite layer, app factory, lifespan

```python
# app/db/__init__.py
USER_ID = "default"                       # single module-level constant (PLAN §7)
def connect(path: str | Path) -> sqlite3.Connection:
    conn = sqlite3.connect(path, timeout=5.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys=ON")
    return conn
def now_iso() -> str: return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")  # PLAN example format

def init_db(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with closing(connect(path)) as conn:
        conn.execute("PRAGMA journal_mode=WAL")            # persistent, set once
        conn.executescript(SCHEMA_SQL)                     # CREATE TABLE IF NOT EXISTS ... (PLAN §7 exactly)
        with conn:                                         # one transaction
            cur = conn.execute("INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, 10000.0, ?)",
                               (USER_ID, now_iso()))
            if cur.rowcount == 1:                          # FRESH db only
                conn.executemany("INSERT INTO watchlist (id, user_id, ticker, added_at) VALUES (?,?,?,?)",
                                 [(str(uuid.uuid4()), USER_ID, t, now_iso()) for t in DEFAULT_TICKERS])
```
Rules: `SCHEMA_SQL` is a Python string constant (no packaging concern, no file lookup in the image). Seed the watchlist **only when the profile row was just inserted** — otherwise a user who later empties the watchlist would get the 10 defaults back on every restart. `DEFAULT_TICKERS = list(SEED_PRICES)` order is AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX [VERIFIED: seed_prices.py SEED_PRICES keys] — identical to PLAN §7's seed list; add a test asserting equality.

**Connection handling:** sync `def` route handlers (FastAPI runs them in a threadpool) that open and close their own connection inside the handler: `with closing(connect(settings.db_path)) as conn:`. Do **not** use a `yield` dependency to hand out a connection: sqlite3 connections are bound to their creating thread by default and FastAPI may run the dependency's setup and teardown on different worker threads [ASSUMED — not reproduced]. The lifespan runs on the event-loop thread and may use sqlite3 directly for its short startup work. Phase 2's process-wide trade lock stays an `asyncio.Lock` on `app.state`; nothing needed now.

**Test isolation:** `create_app(settings)` takes a `Settings(db_path=tmp_path/"t.db", static_dir=None)`; each test builds a fresh app (fresh `PriceCache`, fresh router) and uses `with TestClient(app) as client:` (the `with` is what runs the lifespan). Add an autouse fixture `monkeypatch.delenv("MASSIVE_API_KEY", raising=False)` so a developer shell variable cannot flip tests into Massive mode (the factory reads `os.environ.get("MASSIVE_API_KEY", "").strip()` [VERIFIED: factory.py:22]).

```python
# app/main.py
def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings.from_env()
    cache = PriceCache()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        init_db(settings.db_path)                                   # 1 (D-21)
        with closing(connect(settings.db_path)) as conn:
            tickers = list_tickers(conn)                            # 2
        source = create_market_data_source(cache)
        await source.start(tickers)                                 # 3 simulator priced / Massive first poll done
        app.state.market_source = source
        with closing(connect(settings.db_path)) as conn:
            record_snapshot(conn, cache)                            # 4 startup snapshot (PLAN §7)
        try:
            yield
        finally:
            await source.stop()                                     # 5

    app = FastAPI(lifespan=lifespan)
    app.state.price_cache, app.state.settings = cache, settings
    install_error_handlers(app)
    app.include_router(create_health_router())
    app.include_router(create_portfolio_router(settings, cache))
    app.include_router(create_watchlist_router(settings, cache))
    app.include_router(create_stream_router(cache))
    if settings.static_dir and settings.static_dir.is_dir():        # MUST be last; StaticFiles raises if dir missing
        app.mount("/", StaticFiles(directory=settings.static_dir, html=True), name="static")
    return app
```
Run with `uvicorn app.main:create_app --factory ...` (no import-time side effects; this was the form used in the working spike container).

`Settings.from_env()`:
- `DB_PATH` env (non-empty) else `<repo root>/db/finally.db` where repo root = `Path(__file__).resolve().parents[2]` (`backend/app/config.py` → `parents[0]=app`, `[1]=backend`, `[2]=repo`). Relative env values resolve against CWD. The Docker image sets `DB_PATH=/app/db/finally.db` explicitly, so the `parents[2]` default (which would be `/` inside the image) is never used there.
- `STATIC_DIR` env else `<repo root>/frontend/out`; image sets `/app/static`.

`build_portfolio(conn, cache)` (PORT-01; pure, reused by the snapshot and Phase 2): cash from `users_profile`, positions `ORDER BY ticker`, mark price `cache.get_price(t)` falling back to `avg_cost` (design §15.3), round money to 2 dp at the boundary, return PLAN §8 shape (`cash_balance, positions_value, total_value, unrealized_pnl, positions[]`). `record_snapshot` inserts `(uuid, USER_ID, total_value, now_iso())`.

### Pattern B-6: Error envelope (PLAT-04 is Phase 2 — install the skeleton now, optional)
Cheap now (about 40 lines) and prevents Phase-1 endpoints from ever returning `{"detail": ...}`. `ApiError(code, status, message)` → `JSONResponse({"error": {"code", "message"}}, status)`; `RequestValidationError` → 422 `invalid_request` with the first error message; `StarletteHTTPException` → generic envelope. Verified quirk: an unknown `/api/nope` falls through to the static mount and returns the **HTML 404 page**, not JSON (probe: `/api/nope 404 text/html`), because `StaticFiles` answers it directly. Register a catch-all `@app.api_route("/api/{path:path}")` raising a JSON 404 **before** the static mount. Defer full PLAT-04 verification to Phase 2; do not mark PLAT-04 done in Phase 1.

### Pattern F-1: Tailwind v4 tokens and static-export config (built in spike)
```ts
// next.config.ts
import type { NextConfig } from "next";
const isDev = process.env.NODE_ENV === "development";
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  agentRules: false,   // Next 16.3 `next dev` otherwise writes frontend/AGENTS.md + CLAUDE.md ("@AGENTS.md") into the repo
  ...(isDev ? { async rewrites() { return [{ source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" }]; } } : {}),
};
export default nextConfig;
```
- `postcss.config.mjs`: `export default { plugins: { "@tailwindcss/postcss": {} } };`
- `globals.css`: `@import "tailwindcss";` then `@theme { --color-bg:#0d1117; --color-surface:#161b22; --color-surface-2:#1c2128; --color-border:#30363d; --color-text:#e6edf3; --color-muted:#8b949e; --color-accent:#ecad0a; --color-primary:#209dd7; --color-up:#3fb950; --color-down:#f85149; --color-warn:#d29922; --color-submit:#753991; --font-mono:"JetBrains Mono",ui-monospace,monospace; --text-label:10px; --text-body:12px; --text-heading:14px; --text-display:20px; --breakpoint-desk:75rem; }`. Token names/values are the UI-SPEC contract. The built CSS in the spike contained `--color-accent:#ecad0a` and the `text-text`/`text-accent` utilities, and the `@keyframes flash-up` block.
- `layout.tsx` imports `@fontsource/jetbrains-mono/latin-400.css` and `latin-600.css` (both files exist [VERIFIED: node_modules listing]); the unscoped `400.css`/`600.css` used in the spike also emit cyrillic/greek/latin-ext woff/woff2 files that the UI never uses.
- `next dev` + the dev-only `rewrites()` proxied an SSE stream incrementally (events arrived ~0.5 s apart through `localhost:3010` → `:8765`) [VERIFIED: spike]. A production `next build` with that conditional present produced no warnings. Primary verification is still the container; `next dev` is a convenience.
- Static export caveat: server-render of client components happens during `next build`; touch `window`/`EventSource`/`fetch` only inside `useEffect`, and give `useSyncExternalStore` a `getServerSnapshot` (3rd arg).
- tsconfig: Next rewrites it on first build (adds `.next/dev/types/**/*.ts` to `include`); commit the result. `next-env.d.ts` and `.next/` are already gitignored.
- Tailwind v4 note: `tabular-nums`, `font-mono`, arbitrary variants (`min-[1200px]:`) and the `desk:` custom breakpoint from `--breakpoint-desk` are all native; no `tailwind.config` file.

### Pattern F-2: One price store, `useSyncExternalStore`
Module-level singleton `priceStore` (no library). `connect()` is called from one top-level `useEffect` and is idempotent; `disconnect()` in cleanup (React 19 StrictMode mounts effects twice in dev; the connect→disconnect→connect sequence must leave exactly one open `EventSource`).

State: `latest: Map<ticker, Tick>`, `conn: "connecting"|"open"|"closed"` + `hasOpened: boolean`, per-ticker `ticks: {ts:number; price:number}[]` (cap 50,000, trim in chunks of ~1,000 to avoid O(n) `shift` per tick), per-ticker **running** `first`, `hi`, `lo` (O(1) update, independent of trimming, so "since page load" stays true), `flashSeq`, `flashDir`, `markerDir`. `getSnapshot()` must return a new immutable object only when something changed (bump an integer `version` and cache the snapshot object per version) or React loops.

Ingest rules per SSE event (`JSON.parse(e.data)` is the full ticker set keyed by ticker; ignore tickers not in the watchlist):
```ts
const prev = last.get(t);
const isNew = !prev || tick.timestamp > prev.timestamp;     // dedupe: events resend unchanged tickers
if (!isNew) continue;
push(ticks[t], tick); updateAggregates(t, tick.price);
if (prev && tick.direction !== "flat") {                    // no flash on first observation
  flashSeq[t]++; flashDir[t] = tick.direction; markerDir[t] = tick.direction;   // marker persists through flat ticks
}
```
Why `timestamp` dedupe: each SSE event carries **every** ticker whenever `cache.version` changes [VERIFIED: stream.py:75-83], so in Massive mode (one ticker repricing, others stale) an unchanged ticker would re-flash with its old `direction` on every event. Simulator timestamps are `time.time()` per update (strictly increasing); Massive timestamps are last-trade times (unchanged trade → same timestamp → correctly ignored).

Connection state (D-19, UI-SPEC):
```ts
es.onopen  = () => { hasOpened = true; backoff = 2000; set("open"); };
es.onerror = () => {
  if (es.readyState === EventSource.CLOSED) { set("closed"); es.close(); setTimeout(connect, backoff); backoff = Math.min(backoff * 1.5, 10_000); }
  else set("connecting");                                    // browser is retrying (retry: 1000)
};
```
Label rule: `connecting && !hasOpened` → `CONNECTING`; `connecting && hasOpened` → `RECONNECTING`. Per the HTML spec (cited via MDN), network drops put `readyState` back to CONNECTING and the browser retries using the stream's `retry:` value, whereas a non-200 status or non-`text/event-stream` response makes it CLOSED with no retry; MDN's `readyState` page itself documents only the three values, the fatal-error rule comes from the WHATWG spec [CITED: developer.mozilla.org EventSource/readyState; html.spec.whatwg.org SSE section]. MDN also notes the 6-connections-per-browser-per-domain limit over HTTP/1.1, which matters if the user opens many tabs [CITED: MDN Using_server-sent_events].

### Pattern F-3: Price flash without JS timers
CSS (already in the spike build): `@keyframes flash-up { from{background-color:rgba(63,185,80,.30)} to{background-color:transparent} } .flash-up{animation:flash-up 500ms ease-out}` and the mirror `flash-down`. `PriceCell` renders `<span key={flashSeq} className={suppressed ? "" : flashDir === "up" ? "flash-up" : flashDir === "down" ? "flash-down" : ""}>`: changing the React `key` remounts the span, which restarts the CSS animation (no reflow hack, no timer to clean up). Suppress when `conn !== "open"`. `@media (prefers-reduced-motion: reduce) { .flash-up,.flash-down { animation-duration: 150ms; animation-timing-function: steps(1) } }`. jsdom does not run animations: unit-test that the class is present after a new tick and absent for flat/first/duplicate ticks and when not OPEN, and that `key` changes between ticks.

### Pattern F-4: Sparkline
`<svg viewBox="0 0 80 20" preserveAspectRatio="none" width="100%" height="20"><polyline points=… fill="none" strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round"/></svg>`. Input = `ticks` filtered to `ts >= latest.ts - 300` then `slice(-600)`. x = `i / (n-1) * 80`; y = `18 - (v - min) / (max - min) * 16 + 1` (2 px padding); `max === min` → mid-height line in `muted`; `n < 2` → dashed `border`-colour baseline. Stroke: `up` if last > first, `down` if last < first, else `muted`. Pure function `sparklinePoints(values): string` → easy unit test.

### Pattern F-5: Day % (see OQ-2)
Use `tick.day_change_percent` from the SSE event once present; before the first event use `day_change_percent` from `GET /api/watchlist`. Colour by sign, `muted` at exactly `0.00`, `—` when `null`. No client-side baseline derivation and no debounced refetch are needed.

### Pattern F-6: Lightweight Charts v5 wrapper (typings read this session)
Create once in `useEffect(() => {...}, [])`, `return () => chart.remove()`. Wrap in `next/dynamic(() => import("./ChartCanvas"), { ssr: false })` inside a `"use client"` module (spike pattern built and prerendered).
```ts
import { AreaSeries, ColorType, CrosshairMode, LineStyle, createChart, type UTCTimestamp } from "lightweight-charts";
const chart = createChart(el, {
  autoSize: true,
  attributionLogo: true,   // typings default true (TradingView attribution); leave on unless attribution is provided elsewhere
  layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#8b949e", fontSize: 10, fontFamily: MONO },
  grid: { vertLines: { color: "#21262d" }, horzLines: { color: "#21262d" } },
  rightPriceScale: { borderColor: "#30363d" },
  timeScale: { borderColor: "#30363d", timeVisible: true, secondsVisible: true, rightOffset: 4 },
  crosshair: { mode: CrosshairMode.Normal,
               vertLine: { color: "#484f58", style: LineStyle.Dashed }, horzLine: { color: "#484f58", style: LineStyle.Dashed } },
  localization: { timeFormatter: (t) => new Date((t as number) * 1000).toLocaleTimeString("en-GB") },  // local time; do NOT pre-shift timestamps
});
const series = chart.addSeries(AreaSeries, { lineColor: "#209dd7", lineWidth: 2, topColor: "rgba(32,157,215,0.28)",
  bottomColor: "rgba(32,157,215,0)", lastValueVisible: true, priceLineVisible: true, priceLineColor: "#209dd7",
  priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
```
Names confirmed present in `dist/typings.d.ts`: `ColorType.Solid`, `CrosshairMode.Normal`, `LineStyle.Dashed`, `autoSize`, `secondsVisible`, `rightOffset`, `shiftVisibleRangeOnNewBar` (default behaviour keeps following the live edge when the last bar is visible — what UI-SPEC wants), `timeFormatter`, `tickMarkFormatter`, `attributionLogo`, `AreaStyleOptions.topColor/bottomColor/lineColor/lineWidth`, `ISeriesApi.update(bar, historicalUpdate?)`. Rules from the library maintainers' guidance surfaced by Context7: time is `UTCTimestamp` **integer seconds**, strictly ascending, unique; `update()` appends when `time >` last and replaces when `time ===` last; never call `setData` per tick; null-check `param.time` in crosshair callbacks [CITED: Context7 /tradingview/lightweight-charts library rules].

Data path: on ticker switch, build `points = collapseBySecond(ticks[t])` (floor timestamp, keep latest value per second), `series.setData(points)`, `chart.timeScale().fitContent()`. Live: subscribe imperatively (store `onTick(ticker, cb)`) and `series.update({time: Math.floor(ts) as UTCTimestamp, value: price})`; skip when `time < lastTime`. When `conn !== "open"` dim the container to `opacity: 0.5` (UI-SPEC). In Vitest, **mock `lightweight-charts`** (jsdom has no canvas) and stub `ResizeObserver` and `EventSource` in `vitest.setup.ts`.

### Anti-Patterns to Avoid
- **Module-level `router`/`app = create_app()` at import:** causes duplicate routes and import-time DB access; use the factory + `--factory`.
- **`StaticFiles(...)` without `is_dir()` guard:** raises `RuntimeError: Directory '...' does not exist` at construction (probe-verified) — breaks every backend test and local run before the frontend is built.
- **`COPY . .` into the image:** would bring `.env`, `.claude/`, `node_modules`, `.venv`. Use `.dockerignore` and targeted `COPY`.
- **Seeding the watchlist on every start** (see Pitfall 5).
- **Calling `setData` per tick, recreating the chart per render, or re-running `fitContent` every tick** (yanks a zoomed user back).
- **Global `$ErrorActionPreference = 'Stop'` in the PowerShell scripts** (Pitfall 9).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Canvas price chart | custom canvas/SVG chart | `lightweight-charts` `AreaSeries` | Crosshair, scale, time axis, zoom/scroll are the hard parts |
| Static asset serving + path-traversal safety | custom file route | `starlette.staticfiles.StaticFiles(html=True)` | Handles `/`→`index.html`, `404.html`, traversal checks |
| Font delivery | CDN link / manual `@font-face` | `@fontsource/jetbrains-mono/latin-400.css` | Emitted into `_next/static/media` automatically (verified) |
| Dark theme tokens | ad-hoc CSS variables | Tailwind v4 `@theme` | Produces `bg-bg`, `text-up`, … utilities (verified) |
| SSE reconnect | custom retry loop | native `EventSource` + `retry: 1000` | Only re-create on CLOSED |
| Currency/percent formatting | string slicing | `Intl.NumberFormat("en-US", …)` | Per UI-SPEC |
| Request-validation error shape | per-route try/except | FastAPI exception handlers | One envelope everywhere |
| Image health probe | install curl | python one-liner `HEALTHCHECK` | `python:3.12-slim` has no curl; verified `healthy` |
| Dependency install in image | pip loop | `uv sync --frozen --no-install-project` | Uses `uv.lock`; verified |

**Key insight:** the only genuinely custom pieces are the ones the spec demands (sparkline polyline, treemap in later phases); everything else has a maintained solution that was exercised in the spike.

## Runtime State Inventory

Not a rename/refactor phase, but this machine carries pre-existing runtime state that affects verification:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | Docker volume `finally-data` **already exists** and holds `finally.db` (73,728 bytes) with tables `users_profile, watchlist, positions, trades, portfolio_snapshots, chat_messages` from an earlier attempt (inspected read-only via `docker run --rm -v finally-data:/d …`). Schema may differ from the new `SCHEMA_SQL`; `CREATE TABLE IF NOT EXISTS` will not alter it | Planner: add a `checkpoint:human-verify` before any destructive `docker volume rm finally-data`; for the "fresh DB seeded" check use a throwaway volume name (e.g. `finally-data-test`) or `DB_PATH` temp file |
| Live service config | None | — |
| OS-registered state | None | — |
| Secrets/env vars | `.env` exists at repo root (not read; protected). `.env.example` does not exist yet | Create `.env.example` (names only) |
| Build artifacts | Docker image `finally:latest` exists (created 2026-10-19, `CMD uvicorn app.main:app …`) — **stale**, from an earlier implementation; also unrelated images `finally-e2e-*`. Backend `.venv` has packages not in `uv.lock` (`litellm`, `httpx`, …) | Scripts must not trust "image exists" during this phase's verification: run `--build` first. Do not rely on `.venv` contents as a record of declared deps |

## Common Pitfalls

### Pitfall 1: D-06 is a no-op if only the cache changes
**What goes wrong:** direction still reports flat on sub-cent moves. **Why:** `GBMSimulator.step()` already rounds (`result[ticker] = round(self._prices[ticker], 2)`), so the cache never sees raw values. **Avoid:** change `step()`, `PriceUpdate`, `PriceCache` together (Pattern B-1) and update `test_prices_rounded_to_two_decimals`. **Warning sign:** a pytest that feeds 190.001 then 190.003 still asserts `flat`.

### Pitfall 2: Flash re-triggers from stale directions
**What goes wrong:** every ticker flashes whenever any ticker updates. **Why:** each SSE event carries all tickers. **Avoid:** dedupe on `timestamp` (Pattern F-2). **Also:** do not flash on the first observation after page load.

### Pitfall 3: `docker stop` hangs/kills with an open SSE client
**What goes wrong:** uvicorn waits for the long-lived stream; container is SIGKILLed (exit 137 after ~5.5 s in the spike). **Avoid:** `--timeout-graceful-shutdown 2` (spike: exit 0, ~3.6 s). A noisy `CancelledError … timeout graceful shutdown exceeded` traceback appears in logs; harmless. Keep a single worker (`--workers` omitted) so one cache serves all clients [CITED: .planning/STATE.md blockers].

### Pitfall 4: Stale image / stale volume on this machine
See Runtime State Inventory. A start script that only builds "if image missing" will run the old `finally:latest`.

### Pitfall 5: Re-seeding the watchlist on restart
Seed only when the profile row insert reports `rowcount == 1` (Pattern B-5). Test: init, delete a watchlist row, init again → row stays deleted.

### Pitfall 6: Watchlist order is nondeterministic for ties
All 10 seed rows get the same second-resolution `added_at`. Use `ORDER BY added_at, rowid` (tables are rowid tables; insertion order = seed order) so AAPL is first (D-15). Test asserts the exact 10-ticker order.

### Pitfall 7: `uv run` fails on this machine
`uv run --extra dev pytest` aborted with `failed to remove directory …\finally_backend-0.1.0.dist-info: Access is denied. (os error 5)` (it tries to re-sync the editable project into a venv that something holds open). Both of these ran green (73 passed): `cd backend && uv run --no-sync pytest -q` and `backend/.venv/Scripts/python.exe -m pytest -q`. Use one of them in plan verify commands; keep `uv sync` for Docker only. [VERIFIED: ran this session]

### Pitfall 8: `docker run --env-file` is not a shell dotenv parser
Verified this session: `A="hello world"` arrives as the literal string including quotes; `B=` arrives as the empty string (good: the factory treats whitespace/empty as unset); `C=abc # x` keeps ` # x`. `.env.example` values must be unquoted with comments on their own lines.

### Pitfall 9: PowerShell 5.1 treats native stderr as terminating under `Stop`
Verified on this machine (PowerShell 5.1.26100.9549): with `$ErrorActionPreference='Stop'`, `docker image inspect <missing>` **throws** even with `2>&1 | Out-Null` or `2>$null`; with the default preference it sets `$LASTEXITCODE=1` quietly. `docker rm -f <missing>` exits 0 in both. **Use** `docker images -q finally` (empty output, exit 0 when missing) for existence checks, don't set a global `Stop`, and test `$LASTEXITCODE` after `docker build`/`docker run`. Execution policy here: CurrentUser `RemoteSigned`; document `powershell -ExecutionPolicy Bypass -File scripts\start_windows.ps1` as the fallback.

### Pitfall 10: macOS bash 3.2 and empty arrays under `set -u`
`"${ENV_ARGS[@]}"` with an empty array errors "unbound variable" on bash 3.2 (macOS default) [ASSUMED — well-known, not testable here]. Use `${ENV_ARGS[@]+"${ENV_ARGS[@]}"}`. Add `.gitattributes` with `*.sh text eol=lf` so a Windows checkout does not introduce CRLF into the shell scripts.

### Pitfall 11: Next dev writes agent-rule files
`next dev` (16.3.8) printed "Generated AGENTS.md and CLAUDE.md for AI agents" and created `AGENTS.md` and a `CLAUDE.md` containing `@AGENTS.md` in the project root. In this repo that would add a `frontend/CLAUDE.md` loaded into agent context. Set `agentRules: false` (typed option, `config-shared.d.ts`) or add both files to `.gitignore`.

### Pitfall 12: Day-change baseline after a restart (simulator)
The baseline is the first price seen *this process* (the seed). Day % is therefore always relative to the seed (e.g. AAPL 190.00) and resets on restart; this is the locked D-18 behaviour, not a bug.

### Pitfall 13: Windows-created `package-lock.json` in Linux build
Verified fine for this tree (`npm ci` succeeded in `node:20-slim`). Do not switch to `npm install` in the Dockerfile; keep `npm ci` so lock drift fails the build.

## Code Examples

### C-8: Watchlist entry and route (WATCH-01)
```python
# Source: planning/MARKET_DATA_DESIGN.md §15.2 (design), adapted
def watchlist_entry(ticker: str, added_at: str, cache: PriceCache) -> dict:
    u = cache.get(ticker)
    return {"ticker": ticker,
            "price": u.price if u else None, "previous_price": u.previous_price if u else None,
            "direction": u.direction if u else None, "day_change_percent": u.day_change_percent if u else None,
            "added_at": added_at}

def create_watchlist_router(settings, cache) -> APIRouter:
    router = APIRouter(prefix="/api", tags=["watchlist"])
    @router.get("/watchlist")
    def get_watchlist() -> dict:
        with closing(connect(settings.db_path)) as conn:
            rows = conn.execute("SELECT ticker, added_at FROM watchlist WHERE user_id=? ORDER BY added_at, rowid", (USER_ID,)).fetchall()
        return {"watchlist": [watchlist_entry(r["ticker"], r["added_at"], cache) for r in rows]}
    return router
```

### C-9: Dockerfile (assembled from the two verified spike stages)
```dockerfile
# syntax=docker/dockerfile:1
FROM node:20-slim AS frontend
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build                      # -> /build/out

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.7 /uv /usr/local/bin/uv
ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH" PYTHONUNBUFFERED=1 \
    DB_PATH=/app/db/finally.db STATIC_DIR=/app/static
WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock backend/README.md ./
RUN uv sync --frozen --no-install-project
COPY backend/app ./app
COPY --from=frontend /build/out ./static
RUN mkdir -p /app/db
EXPOSE 8000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://127.0.0.1:8000/api/health', timeout=2).status == 200 else 1)"
CMD ["uvicorn", "app.main:create_app", "--factory", "--host", "0.0.0.0", "--port", "8000", "--timeout-graceful-shutdown", "2"]
```
Spike results: `uv 0.11.7` equals the locally installed `uv` [VERIFIED: `uv --version`]; image built in ~28 s (python stage) / ~75 s (frontend stage, cold); container reported `healthy`; `/` → 200 `text/html`; `/api/stream/prices` streamed `retry: 1000` + `data:` events; named-volume DB survived `docker stop`/`start` (`boots: 1` → `boots: 2`). Note `uv.lock` pins `uv` resolution only; the image needs no `--extra dev`.

`.dockerignore` (root; **do not** ignore `*.md` — `backend/README.md` is referenced by `readme = "README.md"`):
```
.git
.github
.claude
.planning
.vscode
independent-reviewer
planning
test
db
.env
.env.*
!.env.example
**/node_modules
**/__pycache__
**/.venv
**/.pytest_cache
**/.ruff_cache
frontend/.next
frontend/out
backend/htmlcov
```

### C-10: `.env.example`
```
# Required for AI chat (Phase 3). Without it the app still runs; chat returns llm_error.
OPENROUTER_API_KEY=
# Optional: real market data via Massive (Polygon.io). Leave empty to use the built-in simulator.
MASSIVE_API_KEY=
# Optional: "true" for deterministic mock LLM responses (tests)
LLM_MOCK=false
```
Names match `planning/PLAN.md` §5. No quotes, comments on their own lines (Pitfall 8).

### C-11: Start/stop scripts
```bash
#!/usr/bin/env bash
# scripts/start_mac.sh — thin wrapper; --build is the only flag (PLAN §11)
set -euo pipefail
cd "$(dirname "$0")/.."
IMAGE=finally; NAME=finally-app; VOLUME=finally-data; PORT=8000
BUILD=0
for a in "$@"; do case "$a" in --build) BUILD=1 ;; *) echo "Usage: $0 [--build]" >&2; exit 2 ;; esac; done
command -v docker >/dev/null 2>&1 || { echo "Docker not found on PATH." >&2; exit 1; }
docker info >/dev/null 2>&1       || { echo "Docker daemon is not running." >&2; exit 1; }
if [ "$BUILD" = 1 ] || [ -z "$(docker images -q "$IMAGE")" ]; then docker build -t "$IMAGE" .; fi
docker rm -f "$NAME" >/dev/null 2>&1 || true                   # idempotent: restart if already running
ENV_ARGS=()
if [ -f .env ]; then ENV_ARGS=(--env-file .env)
else echo "WARNING: .env not found - starting without it (simulator works; AI chat will return llm_error)." >&2; fi
docker run -d --name "$NAME" -v "$VOLUME":/app/db -p 127.0.0.1:"$PORT":8000 \
  ${ENV_ARGS[@]+"${ENV_ARGS[@]}"} "$IMAGE" >/dev/null
echo "FinAlly is starting at http://localhost:$PORT"
```
`stop_mac.sh`: `docker rm -f finally-app >/dev/null 2>&1 || true; echo "Stopped (data volume finally-data kept)."`. PowerShell equivalents follow Pitfall 9: `param([switch]$Build)`, `Set-Location (Split-Path $PSScriptRoot)`, `if ($Build -or -not (docker images -q finally)) { docker build -t finally . ; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }`, `docker rm -f finally-app *> $null`, `if (Test-Path .env) { $envArgs = @('--env-file','.env') } else { Write-Warning '.env not found - ...' ; $envArgs = @() }`, `docker run -d --name finally-app -v finally-data:/app/db -p 127.0.0.1:8000:8000 @envArgs finally | Out-Null`. Optional (Claude's discretion): poll `docker inspect --format '{{.State.Health.Status}}' finally-app` up to ~30 s before printing the URL so the browser does not open on a refused connection.

**Port binding:** use `127.0.0.1:8000:8000` rather than PLAN §11's `-p 8000:8000` — the app is unauthenticated and (Phase 3) spends the user's OpenRouter key; a bare `-p` publishes it on all host interfaces (LAN). The URL stays `http://localhost:8000`. See OQ-4.

### Verified static-serving probe (this session)
```
/            200 text/html
/index.html  200 text/html
/api/health  200 application/json  {"status":"ok"}
/api/nope    404 text/html          <-- falls into StaticFiles; add JSON catch-all before the mount
StaticFiles(directory="does-not-exist") -> RuntimeError: Directory 'does-not-exist' does not exist
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `chart.addAreaSeries()` | `chart.addSeries(AreaSeries, opts)` | Lightweight Charts v5 | UI-SPEC already mandates v5 API |
| `series.setMarkers()` / chart `watermark` | `createSeriesMarkers` / watermark primitives | v5 | Not used in Phase 1 |
| `tailwind.config.js` + `@tailwind base` | `@import "tailwindcss"` + `@theme` | Tailwind v4 | No config file; `@tailwindcss/postcss` |
| `next lint` | removed (use ESLint CLI directly) | Next 16 | No lint step in Phase 1 [ASSUMED] |
| `autoprefixer`/`postcss-import` in Tailwind pipeline | not needed with v4 plugin | Tailwind v4 | `postcss.config.mjs` has one plugin [CITED: tailwindcss.com upgrade guide via Context7] |

**Deprecated/outdated:** `planning/archive/MASSIVE_API.md` (`day.previous_close`, ms `last_trade.timestamp`) — wrong for the installed `massive` 2.2.0; do not use it as a reference.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node 20 is end-of-life in 2026 | Standard Stack (Alternatives) | Low — only motivates an optional Node 22 bump; DEP-01 keeps Node 20 and the build is proven |
| A2 | FastAPI sync `yield` dependencies may set up/tear down on different threads, breaking thread-bound sqlite3 connections | Pattern B-5 | Low — recommendation (open connection inside the handler) is safe either way |
| A3 | macOS default bash 3.2 errors on empty-array expansion under `set -u` | Pitfall 10 | Low — the `${arr[@]+…}` idiom is harmless on newer bash |
| A4 | `next lint` was removed in Next 16 | State of the Art | Low — no lint step is planned |
| A5 | `httpx` (dev) is legitimate despite pypi seam `unknown-downloads` | Package Legitimacy | Low — already installed, FastAPI's documented TestClient dependency |
| A6 | Massive `updated` field is nanoseconds | Pattern B-4 | Low — used only as a timestamp fallback; clamp/ignore implausible values |
| A7 | Massive free tier will return an auth error for the snapshot endpoint (derived from docs page saying Basic is not included) | B-4, OQ-3 | Medium — if wrong, free keys work and criterion 5 is easier; if right, needs a paid key to verify |
| A8 | The pypi seam's `SUS` for `fastapi`/`uvicorn`/`pytest` is a data limitation (no downloads field), not a risk | Package Legitimacy | Low — these are the existing locked dependencies |

## Open Questions

1. **OQ-1: Flash rule vs D-06.** UI-SPEC: flash "on every received price that differs from the previously displayed price". D-06: direction from unrounded price so "flat" means truly unchanged. A raw move that rounds to the same 2 dp value is `up`/`down` on the wire but looks unchanged.
   - What we know: with the UI-SPEC literal rule, D-06 would have no visible effect (displayed-equal ticks still would not flash).
   - Recommendation: drive flash/marker from the stream's `direction !== "flat"` (plus the new-timestamp dedupe). This honours D-06 and the "flash on each move" success criterion; a flash occasionally accompanies an unchanged 2-dp number, which is acceptable. Planner/checker should treat this as the resolution unless the user objects.
2. **OQ-2: Day % derivation (UI-SPEC "Data Binding").** UI-SPEC derives `baseline = price_at_fetch/(1+pct/100)` client-side. Because `pct` is rounded to 0.01 the reconstructed baseline carries up to about 5e-5 relative error, so the live value can disagree with the server's by 0.01 in the last digit, and it needs a debounced refetch for null starts.
   - Recommendation: add `reference_price` and `day_change_percent` to each SSE ticker object (additive, matches `planning/MARKET_DATA_DESIGN.md` §5/§12) and render `tick.day_change_percent` directly; use the `GET /api/watchlist` value only until the first SSE event. Displayed behaviour is identical; the derivation and refetch hack disappear. Write the two new SSE keys back into PLAN §8 (D-23).
3. **OQ-3: Massive access on the user's key.** Docs say snapshots are not on the free Basic plan. Ask the user which plan their `MASSIVE_API_KEY` is, or accept that criterion 5's "real Massive prices" is verified by real-model unit tests plus a manual check only if a paid key exists. The poller must degrade gracefully (backoff, no crash, key never logged).
4. **OQ-4: Bind the published port to loopback?** Recommend `127.0.0.1:8000:8000` in the scripts (security, §Security Domain). Minor deviation from PLAN §11's literal `-p 8000:8000`; needs a one-line confirmation and a PLAN write-back.
5. **OQ-5: Pre-existing `finally-data` volume / `finally:latest` image.** Is it acceptable to delete them (needed for a true "fresh install" run)? Default plan: do not delete; verify with a differently named volume and always `--build`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker Engine + CLI | DEP-01/03, container verification | ✓ (daemon running) | 29.7.2 client & server | — |
| Docker Desktop volumes | `finally-data` persistence | ✓ (verified persistence) | — | — |
| Node.js | Frontend build/tests (local) | ✓ | v24.21.0 | — |
| npm | Frontend deps | ✓ | 11.19.0 | — |
| `node:20-slim` image | Dockerfile stage 1 | ✓ (pulled during spike) | Node 20 | — |
| `python:3.12-slim` + `ghcr.io/astral-sh/uv:0.11.7` | Dockerfile stage 2 | ✓ (pulled during spike) | uv 0.11.7 | — |
| uv (local) | Backend dev | ✓ | 0.11.7 | `backend/.venv/Scripts/python.exe -m pytest` |
| Python (local venv) | Backend tests | ✓ | 3.12.13 (venv); system `python` is 3.9.7 — do not use | use the venv interpreter |
| PowerShell | `.ps1` scripts | ✓ | 5.1.26100.9549 (no `pwsh`) | — |
| Playwright (test/) | optional smoke | ✓ installed | 1.64.1, chromium builds present | manual browser check |
| Free TCP 8000 on host | container run | ✓ (no listener found) | — | change `PORT` |
| Massive API key / OpenRouter key | live Massive check / chat | unknown (`.env` is protected, not read) | — | simulator mode; unit tests |

**Missing dependencies with no fallback:** none.
**Missing with fallback:** a paid Massive key (live-mode verification) — fall back to real-model unit tests.

## Validation Architecture

`workflow.nyquist_validation` is `false` in `.planning/config.json`, so the formal Nyquist gate is off; this compact map is included because the orchestrator asked how each success criterion can be verified automatically here. `human_verify_mode` is `end-of-phase`.

### Test Framework
| Property | Value |
|----------|-------|
| Backend | pytest 9.0.2 + pytest-asyncio 1.3.0 (`asyncio_mode = "auto"`), config in `backend/pyproject.toml` |
| Frontend | Vitest 5.0.1 + RTL 16.3.3 + jsdom 30.1.3 (proven in spike) |
| Quick run (backend) | `cd backend && uv run --no-sync pytest -q` (73 tests pass today, ~2 s) |
| Quick run (frontend) | `cd frontend && npm test` (~3 s) |
| Full / gate | both of the above + `cd frontend && npm run build` + container checks below |

### Success Criterion → Verification
| # | Behavior | Type | Automated command / check | Exists? |
|---|----------|------|---------------------------|---------|
| 1 | Script builds, runs, prints URL; second run harmless; missing `.env` warns but starts; stop keeps volume | integration (shell) | `bash scripts/start_mac.sh --build && bash scripts/start_mac.sh` then `docker ps --filter name=finally-app`; stop script then `docker volume ls` shows volume. Missing-`.env` path: `git archive HEAD | tar -x -C <tmp>` (no untracked `.env`) and run the script from there. PowerShell: `powershell -ExecutionPolicy Bypass -File scripts\start_windows.ps1` | ❌ Wave 0 |
| 2 | Header $10,000.00, total value, dot colours | unit + human | Vitest: `Header` renders `$10,000.00`; `ConnectionIndicator` with fake `EventSource` for 0/1/2 → `LIVE`/`RECONNECTING`/`OFFLINE`; visual dot colour at end-of-phase human check | ❌ Wave 0 |
| 3 | 10 tickers, ~500 ms updates, flash, Day %, sparklines | pytest + unit + probe | pytest: direction raw-vs-rounded, `day_change_percent`, `to_dict` keys; Vitest: flash class rules, `sparklinePoints`; container probe: `curl -s -N -m 5 localhost:8000/api/stream/prices` → expect ~10 `data:` events with 10 tickers each | ❌ Wave 0 |
| 4 | Click ticker → chart | unit | Vitest with mocked `lightweight-charts`: selecting a row calls `setData` with that ticker's collapsed ticks; ArrowDown moves selection | ❌ Wave 0 |
| 5a | `GET /api/health` | pytest | `TestClient(app).get("/api/health").json() == {"status": "ok"}` | ❌ Wave 0 |
| 5b | DB created/seeded at `DB_PATH`, survives restart | pytest + container | pytest: init twice, one profile row, 10 watchlist rows in order, deleted row not re-seeded, one snapshot row per start; container: `docker restart finally-app` then `docker exec finally-app python -c "import sqlite3;c=sqlite3.connect('/app/db/finally.db');print(c.execute('select count(*) from portfolio_snapshots').fetchone())"` increases | ❌ Wave 0 |
| 5c | Massive parsing | pytest | `parse_snapshot(TickerSnapshot.from_dict(raw))` per design §10.2 example; missing `lastTrade` falls back; `reference_price == prev_day.close` | ❌ Wave 0 |
| 5d | Real Massive prices | manual-only | needs a paid key (OQ-3) | — |
| — | Static serving / API precedence | pytest | `create_app(Settings(db_path=tmp, static_dir=tmp_export))` : `/` 200 HTML, `/api/health` JSON; `static_dir=None` does not raise | ❌ Wave 0 |
| — | SSE router not duplicated (MKT-03); add-before-start (MKT-04) | pytest | per Patterns B-2, B-3 | ❌ Wave 0 |

### Sampling Rate
- Per task commit: the relevant quick command (backend or frontend).
- Per wave merge: both quick commands plus `npm run build`.
- Phase gate: full suite green, container built with `--build`, curl probes above, then the end-of-phase human check (flash fade, dot colours, chart click).

### Wave 0 Gaps
- [ ] `backend/tests/api/test_health_static.py`, `tests/db/test_init_db.py`, `tests/services/test_portfolio.py`, `tests/market/test_stream_router.py`, `tests/market/test_massive_parse.py`, updates to `test_cache.py`/`test_models.py`/`test_simulator.py`/`test_massive.py`/`test_simulator_source.py`
- [ ] `backend/tests/conftest.py`: replace the dead `event_loop_policy` fixture (CONCERNS: ignored by pytest-asyncio 1.x); add autouse `delenv("MASSIVE_API_KEY")`; add `tmp_settings` fixture
- [ ] add `httpx` to dev extra + `uv lock`
- [ ] `frontend/vitest.config.mts` (alias must use `fileURLToPath(new URL("./src", import.meta.url))`; `.pathname` yields `/C:/…` on Windows), `vitest.setup.ts` (jest-dom, `FakeEventSource`, `ResizeObserver` stub, `vi.mock("lightweight-charts")`)
- [ ] Optional smoke: Playwright 1.64.1 is installed under `test/node_modules` with chromium builds present, but `test/` has no `package.json`; Phase 3 owns the E2E suite, so keep Phase 1 verification to the curl/pytest/vitest checks plus the human check [ASSUMED — not run]

## Security Domain

`security_enforcement` is enabled (absent/true), ASVS level 1, block on `high`.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Single-user, no login by design (PLAN §1) — documented, not a gap |
| V3 Session Management | no | No sessions |
| V4 Access Control | partial | Bind published port to loopback (OQ-4); no per-user logic (`user_id` constant) |
| V5 Input Validation | limited | Phase 1 has no user-supplied body/path params; env values parsed with `.strip()`; ticker regex `^[A-Z][A-Z0-9.]{0,9}$` is Phase 2 |
| V6 Cryptography | no | None used |
| V12 Files / V14 Config | yes | `StaticFiles` for path-traversal safety; `.dockerignore` keeps `.env`/`.claude` out of the image; `--env-file` at run time only; base images pinned to major tags |
| V7 Error handling / logging | yes | Never log `MASSIVE_API_KEY`/`OPENROUTER_API_KEY`; redact exception text from the Massive client (CONCERNS: key could appear in exception text) |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secrets baked into image layers | Information disclosure | `.dockerignore` excludes `.env*`; verify with `docker run --rm --entrypoint sh finally -c "ls -a /app"` (no `.env`) and `docker history` |
| Unauthenticated app reachable from LAN | Elevation/Info disclosure | `-p 127.0.0.1:8000:8000` |
| API key leaked via Massive error logging | Information disclosure | Log `type(e).__name__` + sanitized message; never log request objects/headers |
| SSE connection exhaustion | Denial of service | Accepted for single-user; per-client generator is cheap; single worker |
| Path traversal via static route | Tampering | Starlette `StaticFiles` safe-path handling (do not hand-roll a file route) |
| Container runs as root | Elevation | Accepted at ASVS L1 for a local demo; a non-root user needs volume-ownership handling (named volumes inherit image-dir ownership on first create) — optional hardening |

## Project Constraints (from CLAUDE.md)
- Python 3.12 + `uv`, FastAPI, SQLite, Next.js static export with TypeScript + Tailwind, Lightweight Charts only (no second chart library), LiteLLM (Phase 3), SSE with native `EventSource` — fixed by PLAN.md.
- Single container, port 8000, named volume `finally-data` at `/app/db`; no root `docker-compose.yml`; scripts are the only launch path.
- PLAN §8 API shapes/error codes/trade-rule order are binding; money values are plain JSON numbers.
- Backend conventions: `from __future__ import annotations` in every module; module docstring; docstrings on classes/public methods; `logging.getLogger(__name__)` with lazy %-style args and no `print()` in `app/`; ruff (line 100, rules E,F,I,N,W, E501 ignored); black-like formatting; dependencies injected via constructor (no module-level singletons for new state); routers built inside factory functions; money/P&L logic in plain functions taking cache/DB so they test without FastAPI; derived values as `@property`; `to_dict()` explicit; tickers normalized at the API boundary, not inside the cache.
- `app/__init__.py` stays a one-line docstring (no barrel re-exports at `app/` level).
- Tests under `backend/tests/<area>/` mirroring source; `pytest` run via `uv run --extra dev pytest` (use `--no-sync` or the venv interpreter on this machine, Pitfall 7).
- Never read or print `.env`; do not load `.env` contents into source/tests/docs (the Bash secret-read guard enforced this during research).
- GSD workflow: edits go through GSD commands; frontend conventions per UI-SPEC (palette tokens, 4 font sizes/2 weights, no rounded cards/shadows).
- No project skills found under `.claude/skills/` except an empty `cerebras/` directory (Phase 3).

## Sources

### Primary (HIGH confidence)
- Local source files read this session: `backend/app/market/{cache,models,stream,massive_client,simulator,factory,interface,seed_prices,__init__}.py`, `backend/pyproject.toml`, `backend/uv.lock`, `backend/tests/**` (grep), `planning/PLAN.md` (§5–§13), `planning/MARKET_DATA_DESIGN.md` (§0, 5, 6, 9.3, 10, 12, 14, 15, 16), `planning/MARKET_DATA_SUMMARY.md`, `.planning/{PROJECT,REQUIREMENTS,ROADMAP,STATE,config}`, `.planning/codebase/CONCERNS.md`, `01-CONTEXT.md`, `01-UI-SPEC.md`
- Installed `massive` 2.2.0 package sources (`rest/models/{snapshot,trades,aggs}.py`, `rest/snapshot.py`) and an executed `TickerSnapshot.from_dict` call
- Installed `lightweight-charts` 5.2.1 `dist/typings.d.ts` (option/enum names)
- Spike builds and runs (scratchpad): Next static export on Node 24 and `node:20-slim`, Vitest, python:3.12-slim + uv image, container health/volume/stop behaviour, StaticFiles probe, next-dev SSE proxy probe, PowerShell 5.1 probe, `--env-file` probe
- npm registry (`npm view`) for versions, engines, publish dates, scripts.postinstall (null for next and fontsource)
- Context7 `/vercel/next.js/v16.2.9` (static export config, `next/dynamic` ssr:false), `/tradingview/lightweight-charts` (v5 API + maintainer library rules), `/websites/tailwindcss` (v4 PostCSS + `@theme`)

### Secondary (MEDIUM confidence)
- massive.com full-market-snapshot docs (plan availability, `prevDay`, clearing time) — fetched via WebFetch (small-model summary)
- MDN EventSource `readyState` and Using server-sent events (6-connection limit, retry semantics); fatal-error rule from the WHATWG spec as relayed by the fetch summary
- Web search on Basic-plan limits (5 calls/min, EOD data) — did not confirm snapshot access either way

### Tertiary (LOW confidence)
- None relied on without a tag (see Assumptions Log)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every pinned version installed and built locally and in `node:20-slim`
- Architecture: HIGH for backend wiring and Docker (run end-to-end); MEDIUM for frontend component internals (design is prescriptive but not yet executed beyond the chart/Tailwind/font/Vitest skeleton)
- Pitfalls: HIGH — most were reproduced this session
- Massive live behaviour: MEDIUM-LOW — no key; plan-availability is from docs only

**Research date:** 2026-10-20
**Valid until:** 2026-11-03 (npm ecosystem is moving daily; re-run `npm view` before pinning if planning slips past two weeks)

## Orchestrator-Resolved Open Questions (user decisions, 2026-10-20)

- **OQ-1 (flash trigger):** Adopt the recommendation. Flash and the ▲/▼ marker are driven by the stream's `direction !== "flat"`. They are de-duplicated by `timestamp`, so a ticker resent unchanged does not re-flash.
- **OQ-2 (Day %):** Adopt the recommendation. Use the SSE `day_change_percent` (an additive key) directly. The displayed result matches the UI-SPEC's client-side derivation.
- **OQ-3 (Massive plan):** The user has no key and runs the simulator only. Massive mode must fail soft and is proven by unit tests built from real `TickerSnapshot.from_dict` models. The "real Massive prices" half of success criterion 5 is manual-only and needs a paid key.
- **OQ-4 (port bind):** Bind to localhost only with `-p 127.0.0.1:8000:8000` in both start scripts. This is a recorded deviation from PLAN §11, made because the app is unauthenticated.
- **OQ-5 (stale Docker artifacts):** Do NOT delete the existing `finally:latest` image or `finally-data` volume. Verification uses `--build` and a separately named test volume and container.
