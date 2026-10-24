# FinAlly — AI Trading Workstation

## What This Is

FinAlly (Finance Ally) is a single-user, browser-based AI trading workstation that streams live market prices, lets the user trade a simulated $10,000 portfolio, and includes an LLM chat assistant that analyzes positions and executes trades and watchlist changes on the user's behalf. It looks and feels like a dark, data-dense Bloomberg-style terminal with an AI copilot. It is the capstone project for an agentic AI coding course and is built entirely by coding agents; the full specification is `planning/PLAN.md`, which this project implements exactly.

## Core Value

The live demo must work and impress from one Docker command: prices stream and flash, manual trades fill instantly, and the AI chat executes trades through natural language. When tradeoffs arise, the end-to-end demo experience wins over breadth or polish elsewhere.

## Requirements

### Validated

<!-- Shipped and confirmed — inferred from the existing codebase (.planning/codebase/). -->

- ✓ Market data abstraction: `MarketDataSource` interface with simulator and Massive implementations selected by `MASSIVE_API_KEY` — existing (`backend/app/market/`)
- ✓ GBM price simulator: correlated moves via Cholesky, random 2–5% events, realistic seed prices, ~500ms ticks — existing
- ✓ Thread-safe in-memory `PriceCache` with version counter for change detection — existing
- ✓ SSE endpoint `GET /api/stream/prices` streaming all tickers every ~500ms with `retry: 1000` — existing (router factory only; no app mounts it yet)
- ✓ Unit tests for cache, models, simulator, factory, and Massive client (mocked) — existing (`backend/tests/market/`)

### Active

<!-- Everything else in planning/PLAN.md. Hypotheses until shipped. -->

- [ ] Fix known market data defects: Massive `last_trade.timestamp` bug (field is `sip_timestamp`, ns), module-level SSE router duplicated by the factory, simulator dropping tickers added before `start()`, removed ticker reappearing after an in-flight Massive poll
- [ ] FastAPI app entry point with lifespan-managed DB init, market data startup, startup portfolio snapshot, and static frontend serving (API routers registered before the static mount)
- [ ] SQLite persistence (`DB_PATH` env, default `db/finally.db`; `/app/db/finally.db` in Docker) with the six-table schema and default seed (cash $10,000, 10-ticker watchlist)
- [ ] Portfolio API: `GET /api/portfolio`, `POST /api/portfolio/trade`, `GET /api/portfolio/history` exactly per PLAN.md §8 contracts and trade rules, atomic per trade and serialized across manual + LLM trades
- [ ] Watchlist API: `GET/POST /api/watchlist`, `DELETE /api/watchlist/{ticker}` (409 `position_open`), registering/unregistering tickers with the market data source
- [ ] Uniform error body `{"error": {"code", "message"}}` for every non-2xx response, with the error-code table from PLAN.md §8
- [ ] Chat: `POST /api/chat` (LiteLLM → OpenRouter `openrouter/openai/gpt-oss-120b`, Cerebras provider, structured outputs), fixed action order (watchlist adds → trades → removals), per-action results, `llm_error` handling; `GET /api/chat` for history
- [ ] Deterministic `LLM_MOCK=true` mode for development and E2E tests
- [ ] Next.js static-export frontend: watchlist with flashing prices and SVG sparklines, main chart (Lightweight Charts), portfolio treemap heatmap, P&L chart with live final point, positions table, trade bar, collapsible AI chat panel with inline action results, header with live total value / cash / connection dot
- [ ] Multi-stage Dockerfile, `.env.example`, start/stop scripts for macOS/Linux and Windows
- [ ] Backend pytest suite, frontend unit tests, and Playwright E2E suite run via `test/docker-compose.test.yml` with `LLM_MOCK=true`

### Out of Scope

- Authentication, multiple users, user-resolution logic — single user by design; `user_id` is a constant
- Limit orders, order book, partial fills, fees, fractional shares — market orders, whole shares only
- Token-by-token chat streaming — Cerebras is fast enough; loading indicator suffices
- Backend price-history buffer — charts and sparklines accumulate in the browser since page load; refresh empties them (accepted)
- Periodic portfolio snapshot task — snapshots at startup and after each trade only; frontend extends the line live
- Realized P&L display — total value vs. $10,000 start already captures it
- Reset endpoint — documented `docker volume rm finally-data` instead
- Root `docker-compose.yml`, cloud deployment (Terraform, App Runner) — start scripts are the only launch path
- Second charting library — Lightweight Charts only; sparklines and treemap are hand-rolled

## Context

- Brownfield: only `backend/app/market/` exists as application code (see `.planning/codebase/`). Frontend, scripts, Dockerfile, database, APIs, LLM integration, and E2E tests are all to be built.
- `planning/PLAN.md` is the shared contract between agents; field names in its API contracts are exact. Decisions made during the build must be written back into it.
- `.planning/codebase/CONCERNS.md` documents verified defects in the market data code, including the Massive timestamp bug that makes real-data mode produce no prices.
- `test/` already contains Playwright in `node_modules`; `test/tests/` is empty.
- The `.claude/skills/cerebras/` directory referenced by PLAN.md §9 is empty; the LiteLLM/OpenRouter call pattern must be implemented from LiteLLM docs.
- Dev machine is Windows 11 with Docker Desktop, Node 24, uv 0.11; scripts must work on both PowerShell and macOS/Linux.

## Constraints

- **Tech stack**: FastAPI + uv (Python 3.12), SQLite, Next.js static export with TypeScript + Tailwind, Lightweight Charts, LiteLLM — fixed by PLAN.md
- **Deployment**: single Docker container on port 8000, named volume `finally-data` at `/app/db` — one-command student experience
- **Realtime**: SSE only, native `EventSource` — one-way push, no WebSockets
- **LLM**: `openrouter/openai/gpt-oss-120b` via OpenRouter with Cerebras provider, `OPENROUTER_API_KEY` from root `.env` — course requirement
- **Visual**: dark theme (~`#0d1117`), accent `#ecad0a`, blue `#209dd7`, purple `#753991` submit buttons; desktop-first
- **Contracts**: API shapes, error codes, and trade-rule order in PLAN.md §8 are binding

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Implement PLAN.md exactly as written | User confirmed the spec is the product | — Pending |
| Live demo is the priority when tradeoffs arise | User's stated core value | — Pending |
| Resolve PLAN.md §13.2 open questions with its own recommendations and write them back to PLAN.md | User chose recommended defaults | — Pending |
| DB init, market data start, and startup snapshot run in FastAPI lifespan | Startup snapshot and data source need the DB at startup (§13.2 item 8) | — Pending |
| `day_change_percent` baseline = first price seen since server start (simulator); previous close in Massive mode | Simplest well-defined baseline (§13.2 item 12) | — Pending |
| Simulator accepts any well-formed ticker with a random seed price; Massive does not pre-validate symbols | Keeps add-ticker simple; documented limitation (§13.2 item 11) | — Pending |
| Full sell deletes the position row; buys use weighted-average cost; partial sells keep `avg_cost` | Standard position lifecycle (§13.2 item 17) | — Pending |
| Each trade is one SQLite transaction, serialized by a process-wide async lock shared by manual and LLM trades | Atomicity and no interleaving (§13.2 item 19) | — Pending |
| Add `GET /api/chat` returning stored history; LLM context uses the last 20 messages | Chat survives reload (§13.2 items 22, 23) | — Pending |
| `LLM_MOCK` uses deterministic keyword matching (e.g. "buy N TICKER" adds to watchlist and buys) with a fixed fallback reply | E2E tests and backend agree on behavior (§13.2 item 26) | — Pending |
| Structured-output schema makes `trades` and `watchlist_changes` required arrays (may be empty) | Strict structured outputs need all fields (§13.2 item 27) | — Pending |
| Frontend refetches `/api/portfolio` (and `/api/watchlist` after chat actions) after every action; live total value is recomputed client-side from SSE prices | Clear refresh strategy (§13.2 item 29) | — Pending |
| Connection dot maps `EventSource.readyState`: OPEN = green, CONNECTING = yellow, CLOSED = red | §13.2 item 30 | — Pending |
| `DB_PATH` env var with default `db/finally.db` | Local vs. Docker paths differ (§13.2 item 32) | — Pending |
| Missing `.env`: start scripts warn and run without `--env-file` (simulator works; chat returns `llm_error`); `.env.example` is committed | §13.2 item 6 | — Pending |
| No backend price-history buffer; chart history is browser-only | User chose spec as written (§13.2 item 13) | — Pending |
| Fix known market data defects in scope | Massive mode currently yields no prices | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-20 after initialization*
