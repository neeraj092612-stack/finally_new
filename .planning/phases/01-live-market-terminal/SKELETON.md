# Walking Skeleton — FinAlly (AI Trading Workstation)

**Phase:** 1
**Generated:** 2026-10-20

## Capability Proven End-to-End

One start script builds and runs a single container whose FastAPI process seeds SQLite, starts the market simulator, and serves a dark terminal page at http://localhost:8000 that shows the 10 default tickers streaming live over SSE next to a $10,000 portfolio.

The tracer for this skeleton is plan 01-01 Task 1: a real uvicorn process (`app.main:create_app --factory`) proving SQLite seed -> lifespan -> simulator -> PriceCache -> `/api/watchlist` and `/api/stream/prices`, plus `/api/health` and the static mount. The frontend leg starts in parallel (01-02, after the dependency checkpoint) and the deployment leg closes the loop through the container and scripts (01-06, final rebuild in 01-07).

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework (backend) | FastAPI 0.128 on uvicorn, app factory `create_app(settings)` run with `--factory`, sync `def` routes | Fixed by planning/PLAN.md; the factory avoids import-time side effects and duplicate routes in tests |
| Framework (frontend) | Next.js 16.3.8 App Router, `output: "export"`, React 19.3, Tailwind v4 `@theme` tokens, TypeScript 5.9 | Static export served by FastAPI on one origin and one port (PLAN section 3) |
| Data layer | SQLite via stdlib `sqlite3`, WAL, short-lived per-request connections, schema as a Python constant in `backend/app/db/schema.py`, `USER_ID = "default"` constant | Single user, zero config; schema is PLAN section 7 verbatim (one-way on-disk format, settled by PLAN) |
| Database location | `DB_PATH` env (default `db/finally.db`; `/app/db/finally.db` in Docker on the `finally-data` volume) | D-21, PLAN 13.2 item 32 |
| Startup order | FastAPI lifespan: `init_db` (create + seed once) -> read watchlist -> start market source -> startup snapshot -> serve; stop source on shutdown | D-21, PLAN 13.2 item 8 |
| Market data | Existing `MarketDataSource` (simulator default, Massive when `MASSIVE_API_KEY` set) writing to one shared `PriceCache` per app | Producers write the cache, consumers read it; downstream code is source-agnostic |
| Realtime | SSE `GET /api/stream/prices`, native `EventSource`, one module-level store read via `useSyncExternalStore`, flash driven by stream `direction` de-duplicated by `timestamp` | PLAN section 6; OQ-1 |
| Wire additions | SSE objects add `reference_price` and `day_change_percent`; direction computed from unrounded prices | D-06, D-18, OQ-2 |
| Errors | `{"error": {"code", "message"}}` envelope via FastAPI handlers; unknown `/api/*` returns JSON 404 before the static mount | PLAN section 8; skeleton for PLAT-04 in Phase 2 |
| Charts | Lightweight Charts 5 area series for the main chart; hand-rolled SVG sparklines; no second charting library | PLAN section 10 |
| Auth | None (single local user); the app is published on 127.0.0.1 only | PLAN section 1; OQ-4 |
| Deployment target | One Docker image (node:20-slim build stage -> python:3.12-slim + uv 0.11.7), one container on port 8000, single uvicorn worker, `--timeout-graceful-shutdown 2`, launched only by `scripts/start_*.{sh,ps1}` | PLAN section 11; DEP-01..03 |
| Directory layout | `backend/app/{main,config,errors}.py`, `backend/app/{db,services,api,market}/`, tests mirrored under `backend/tests/<area>/`; `frontend/app/` + `frontend/src/{lib,components,__tests__}` with alias `@/* -> src/*` | Matches the hatch `app` package and the RESEARCH spike |
| Tests | pytest (`cd backend && uv run --no-sync pytest -q`), Vitest + RTL + jsdom locally on Node 22.12+ (`npm --prefix frontend test`) | Proven on this machine; Vitest never runs in the Node 20 Docker stage |

## Stack Touched in Phase 1

- [ ] Project scaffold (framework, build, lint, test runner) — 01-01 (backend factory, ruff, pytest), 01-02 (Next.js, Tailwind, Vitest)
- [ ] Routing — at least one real route — `/api/health`, `/api/watchlist`, `/api/portfolio`, `/api/stream/prices`, static `/` (01-01, 01-04)
- [ ] Database — at least one real read AND one real write — seed and startup snapshot writes, watchlist and portfolio reads (01-01, 01-04)
- [ ] UI — at least one interactive element wired to the API — watchlist row selection driving the chart over live SSE data (01-05, 01-07)
- [ ] Deployment — running on dev environment OR documented local full-stack run command — `scripts/start_mac.sh` / `scripts/start_windows.ps1` (01-06, final rebuild 01-07)

## Out of Scope (Deferred to Later Slices)

- Trading (buy/sell, trade bar), watchlist add/remove, positions table, heatmap, P&L chart — Phase 2 (panels exist as titled empty states now)
- Full error-code coverage for trade and watchlist rules (PLAT-04) — Phase 2
- AI chat, LiteLLM/OpenRouter integration, `LLM_MOCK`, `GET /api/chat` — Phase 3
- Playwright E2E suite and `test/docker-compose.test.yml` — Phase 3
- Server-side price history, symbol validation in Massive mode, reset endpoint, realized P&L — v2 (ENH-01..04)
- Authentication, multi-user, cloud deployment, root docker-compose.yml — out of scope by PLAN

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- Phase 2: Manual trading and portfolio — watchlist add/remove, buy/sell from the trade bar, positions table, heatmap and P&L chart that react to every trade (atomic trades behind a process-wide lock, snapshots after each trade).
- Phase 3: AI trading copilot — chat panel that analyzes the portfolio and executes trades and watchlist changes through the same code paths, plus the complete backend, frontend and Playwright E2E suites with a mocked LLM.
