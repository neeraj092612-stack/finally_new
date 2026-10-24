# Roadmap: FinAlly — AI Trading Workstation

## Overview

FinAlly goes from a market-data-only backend to a complete, demo-ready AI trading workstation in three vertical slices. Phase 1 builds the walking skeleton end to end: one start script launches a single container that serves a dark terminal page with the default watchlist streaming and flashing live prices and a $10,000 portfolio. Phase 2 lets the user change the portfolio: add and remove watchlist tickers, buy and sell from a trade bar, and see positions, heatmap and P&L chart react to every trade. Phase 3 adds the AI copilot that analyzes the portfolio and trades through natural language, and finishes with the automated suites (backend, frontend and Playwright E2E with a mocked LLM) that cover the whole demo.

## Planning Notes

- **Contract:** `planning/PLAN.md` §8 shapes, error codes and trade-rule order are binding. Each phase writes the §13.2 decisions it implements (see PROJECT.md Key Decisions) back into `planning/PLAN.md`.
- **One-command launch from day one:** Docker, `.env.example` and the start/stop scripts are in Phase 1, so every later phase is verified through the same launch path the user runs.
- **Tests ship with the code:** every phase adds backend pytest and frontend unit tests for what it builds. TEST-01 and TEST-02 are marked complete in Phase 3, once the suites cover everything they list. TEST-03 (E2E) needs the chat mock, so it also lands in Phase 3.
- **Phase 3 is an AI-integration phase:** consider `/gsd-ai-integration-phase 3` before planning. `.claude/skills/cerebras/` is empty, so the LiteLLM → OpenRouter (Cerebras provider) structured-output call must be built from the LiteLLM docs.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Live Market Terminal** - One start script launches the container; the browser shows the default watchlist streaming and flashing live prices with sparklines, a main chart and a $10,000 portfolio header
- [ ] **Phase 2: Manual Trading & Portfolio** - Watchlist add/remove, buy/sell from the trade bar, and a positions table, heatmap and P&L chart that react to every trade
- [ ] **Phase 3: AI Trading Copilot** - Chat with FinAlly to analyze the portfolio and execute trades and watchlist changes in natural language, with the full demo covered by passing unit and E2E suites

## Phase Details

### Phase 1: Live Market Terminal

**Goal**: User starts the app with one script, opens http://localhost:8000, and watches the 10 default tickers stream live with flashing prices, sparklines and a main chart, next to a $10,000 portfolio
**Mode:** mvp
**Depends on**: Nothing (first phase)
**Requirements**: MKT-01, MKT-03, MKT-04, MKT-05, PLAT-01, PLAT-02, PLAT-03, PLAT-05, PLAT-06, PLAT-07, PORT-01, WATCH-01, UI-01, UI-02, UI-04, DEP-01, DEP-02, DEP-03
**Success Criteria** (what must be TRUE):
  1. Running `scripts/start_mac.sh` or `scripts/start_windows.ps1` builds the image if needed (or on `--build`), runs one container on port 8000 with the `finally-data` volume, and prints the URL. Running it again is harmless, it still starts (with a warning) when `.env` is missing, and the matching stop script removes the container but keeps the data.
  2. Opening http://localhost:8000 shows a dark terminal-style page whose header shows $10,000.00 cash, the total portfolio value, and a connection dot that is green while streaming, yellow while reconnecting and red when disconnected.
  3. The watchlist shows AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V and NFLX with prices that update about every 500ms, flash green or red on each move and fade within ~500ms, show a day change %, and draw sparklines that fill in from page load.
  4. Clicking a watchlist ticker shows it in the main chart as price over time since page load.
  5. `GET /api/health` returns `{"status": "ok"}`. The database is created and seeded at `DB_PATH` on first start and survives a container restart. With `MASSIVE_API_KEY` set, the same watchlist shows real Massive prices (day change against the previous close) instead of simulated ones.

**Plans:** 7/14 plans executed (5 waves)
Plans:
**Wave 1**
- [x] 01-01-PLAN.md — Backend walking-skeleton tracer: one uvicorn process seeds SQLite, streams the seeded tickers over SSE, serves the static mount and /api/health (wave 1)
- [x] 01-02-PLAN.md — Dependency checkpoint, exact-pinned frontend toolchain and the shared Vitest harness (wave 1)
- [x] 01-03-PLAN.md — Market core fixes: D-06 raw-price direction, D-18 simulator day-change baseline, MKT-04 pre-start queue (wave 1)

**Wave 2** *(blocked on Wave 1 completion)*
- [x] 01-04-PLAN.md — Terminal grid in the static export: theme tokens, fonts, panel chrome, empty states, tablet chat collapse (wave 2)
- [x] 01-05-PLAN.md — Shared SSE price store, connection indicator, formatters and API fetchers (wave 2)
- [x] 01-06-PLAN.md — GET /api/watchlist and GET /api/portfolio with the startup snapshot (wave 2)
- [x] 01-07-PLAN.md — Per-app SSE router (MKT-03) and Massive parsing with the previous-close baseline and fail-soft polling (wave 2)

**Wave 3** *(blocked on Wave 2 completion)*
- [ ] 01-08-PLAN.md — Live header: one stream connection, connection dot, cash and live total value (wave 3)
- [ ] 01-09-PLAN.md — JSON error envelope and /api catch-all, httpx TestClient tests, DB/config edge tests (wave 3)
- [ ] 01-10-PLAN.md — Watchlist panel components: flashing prices, markers, Day %, sparklines and load states (wave 3)
- [ ] 01-11-PLAN.md — .env.example, .dockerignore and the multi-stage Dockerfile verified on a test container (wave 3)

**Wave 4** *(blocked on Wave 3 completion)*
- [ ] 01-12-PLAN.md — Watchlist in the page: AAPL selected on load, click and keyboard selection drive the chart title (wave 4)
- [ ] 01-13-PLAN.md — Start/stop scripts (bash and PowerShell) and the PLAN.md write-back (wave 4)

**Wave 5** *(blocked on Wave 4 completion)*
- [ ] 01-14-PLAN.md — Main chart (Lightweight Charts area series) and the final rebuild through the start script (wave 5)

**UI hint**: yes

### Phase 2: Manual Trading & Portfolio

**Goal**: User manages the watchlist and buys and sells shares from the trade bar, and every trade immediately shows up in cash, the positions table, the heatmap and the P&L chart
**Mode:** mvp
**Depends on**: Phase 1
**Requirements**: MKT-02, PLAT-04, PORT-02, PORT-03, PORT-04, PORT-05, PORT-06, PORT-07, WATCH-02, WATCH-03, UI-03, UI-05, UI-06, UI-07, UI-08
**Success Criteria** (what must be TRUE):
  1. User can add a ticker such as PYPL from the watchlist panel and see it start streaming, then remove it and see it stop streaming and never reappear (in Massive mode too). Removing a held ticker or adding a malformed one shows a readable inline error and changes nothing.
  2. User can buy whole shares of a watched ticker from the trade bar with no confirmation. Cash drops by quantity × fill price, and the positions table shows the ticker with quantity, weighted average cost, current price, and unrealized P&L and % that update live with streamed prices.
  3. User can sell part of a position (average cost unchanged) or all of it (the row disappears), and cash rises by quantity × price. Buying beyond available cash, selling more than is held, or trading an unwatched or unpriced ticker shows the specific error message from the `{"error": {"code", "message"}}` body and leaves cash and positions untouched.
  4. The heatmap shows one rectangle per position, sized by portfolio weight and colored green or red by P&L. The P&L chart plots total value from the startup snapshot and one point per trade, plus a live final point that moves with prices.
  5. Rapid successive trades never leave cash, positions, the trade log and value history out of step. After a container restart, the watchlist, cash, positions and P&L history are exactly as they were.

**Plans**: TBD
**UI hint**: yes

### Phase 3: AI Trading Copilot

**Goal**: User chats with FinAlly to analyze the portfolio and has it execute trades and watchlist changes in plain language, and passing backend, frontend and Playwright E2E suites cover the complete demo
**Mode:** mvp
**Depends on**: Phase 2
**Requirements**: CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05, CHAT-06, CHAT-07, UI-09, UI-10, TEST-01, TEST-02, TEST-03
**Success Criteria** (what must be TRUE):
  1. User types "Buy 5 shares of PYPL" into the docked, collapsible chat panel and sees a loading indicator. The reply then shows inline that PYPL was added and 5 shares were bought, and the watchlist, positions table, heatmap and header update without a page reload.
  2. Asking "How is my portfolio doing?" returns a concise reply that cites the user's actual cash, positions, P&L and watched prices.
  3. When one requested action is impossible (e.g. buying more than cash allows), it appears inline as failed with its reason while the other actions still execute. When the LLM call itself fails (missing key, timeout, invalid output), the chat shows an error and nothing is traded.
  4. Reloading the page shows the earlier conversation, including each message's action results.
  5. With `LLM_MOCK=true`, chat works without an API key and replies deterministically. The backend pytest suite and the frontend unit suite pass, and `test/docker-compose.test.yml` runs the Playwright suite green against the app container (fresh start, watchlist add/remove, buy, sell, portfolio visualizations, mocked chat trade).

**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Live Market Terminal | 7/14 | In Progress | - |
| 2. Manual Trading & Portfolio | 0/TBD | Not started | - |
| 3. AI Trading Copilot | 0/TBD | Not started | - |
