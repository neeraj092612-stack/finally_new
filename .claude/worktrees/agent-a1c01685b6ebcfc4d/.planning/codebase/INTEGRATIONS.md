---
last_mapped_commit: ab8faa811f2fa60fcadbd0de3c6af2005521e5ce
last_mapped_at: 2026-10-19
---
# External Integrations

**Analysis Date:** 2026-10-19

## APIs & External Services

**Market Data:**
- Massive (Polygon.io) REST API - Optional live market data source
  - Implementation: `backend/app/market/massive_client.py` (`MassiveDataSource`)
  - SDK/Client: `massive` package, `RESTClient` (`from massive import RESTClient`), `SnapshotMarketType` from `massive.rest.models`
  - Endpoint used: `GET /v2/snapshot/locale/us/markets/stocks/tickers` via `RESTClient.get_snapshot_all(...)`, polled for the union of all watched tickers
  - Polling is run in a worker thread with `asyncio.to_thread(self._fetch_snapshots)`
  - Auth: `MASSIVE_API_KEY` environment variable (read in `backend/app/market/factory.py`)
  - Selected only when `MASSIVE_API_KEY` is non-empty; otherwise the built-in simulator is used
  - Rate limits: free tier allows 5 calls/min, so poll interval is about 15 seconds (per `planning/PLAN.md`); paid tiers 2 to 15 seconds

- Built-in market simulator - No external service
  - Implementation: `backend/app/market/simulator.py` (`SimulatorDataSource`), seed data in `backend/app/market/seed_prices.py`
  - Generates prices with geometric Brownian motion, correlated moves via Cholesky decomposition (`numpy`), and random events
  - Runs in-process as an asyncio background task; ~500 ms update interval

**LLM / AI Chat (planned, not yet implemented):**
- OpenRouter - LLM gateway for the chat assistant
  - Model: `openrouter/openai/gpt-oss-120b` with Cerebras as the inference provider (per `planning/PLAN.md` sections 5 and 9, and `README.md`)
  - Client: LiteLLM (planned; not yet declared in `backend/pyproject.toml`)
  - Auth: `OPENROUTER_API_KEY` environment variable (documented; not yet read by code)
  - Uses structured outputs for trade and watchlist actions
  - Mock mode: `LLM_MOCK=true` returns deterministic responses without a network call (planned)
  - No code currently calls OpenRouter; no `litellm` import exists in `backend/`

**Claude GitHub Automation:**
- Anthropic Claude Code GitHub Action (`anthropics/claude-code-action@v1`) - Defined in `.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml`
  - Auth: `secrets.CLAUDE_CODE_OAUTH_TOKEN` (GitHub secret, referenced by name only)
  - Not part of the application runtime

## Data Storage

**Databases:**
- SQLite (planned)
  - Connection: planned file path `db/finally.db` locally, `/app/db/finally.db` in Docker (named volume `finally-data`); no `DB_PATH` variable defined yet
  - Client: Python standard library `sqlite3` is planned; no database code exists yet in `backend/app/`
  - Schema, seed data, and lazy initialization are planned under `backend/db/` (directory not yet created)
  - Tables planned per `planning/PLAN.md` section 7: `users_profile`, `watchlist`, `positions`, `trades`, `portfolio_snapshots`, `chat_messages`
  - `.gitignore` excludes `db/*.db`, `db/*.db-journal`, `db/*.db-wal`, `db/*.db-shm`, and `*.sqlite3`

**File Storage:**
- Local filesystem only (for the SQLite file). No cloud object storage.

**Caching:**
- In-memory price cache: `backend/app/market/cache.py` (thread-safe, stores latest price, previous price, and timestamp per ticker). Not an external service.

## Authentication & Identity

**Auth Provider:**
- None. The app is single-user with no login. `user_id` is a hardcoded constant of `"default"` in the schema (per `planning/PLAN.md` section 7).
- The only credentials are the API keys for Massive and OpenRouter, held in environment variables.

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Python `logging` module, module-level loggers (`logging.getLogger(__name__)`) in `backend/app/market/` (for example `factory.py`, `massive_client.py`, `simulator.py`, `stream.py`)
- Console output only; no log shipping configured

## CI/CD & Deployment

**Hosting:**
- Planned: single Docker container on port 8000, started by `scripts/start_mac.sh` or `scripts/start_windows.ps1` (not yet present; `scripts/` is empty)
- Cloud deployment is out of scope (per `planning/PLAN.md` section 13.1)

**CI Pipeline:**
- No test or build pipeline detected. The only workflows are the Claude GitHub automation workflows in `.github/workflows/`.

## Real-Time Streaming

**Server-Sent Events:**
- Endpoint: `GET /api/stream/prices`, implemented in `backend/app/market/stream.py` (FastAPI `APIRouter` and `StreamingResponse`)
- Sends an initial `retry: 1000` line, then one unnamed event about every 500 ms with all tracked tickers
- Client: browser `EventSource` (planned frontend, same origin, no CORS)
- Not yet mounted in a FastAPI application entry point (no `backend/app/main.py` exists yet)

## Environment Configuration

**Required env vars:**
- `OPENROUTER_API_KEY` - Required for chat (planned; not yet read by code)

**Optional env vars:**
- `MASSIVE_API_KEY` - Enables Massive market data; empty or absent selects the simulator (read in `backend/app/market/factory.py`)
- `LLM_MOCK` - `true` for deterministic mock LLM responses (planned)

**Secrets location:**
- `.env` file in the project root (gitignored). The backend is to read it directly or via Docker `--env-file .env`. Contents are not recorded in this document.
- `.env.example` is specified as committed but does not yet exist.

## Webhooks & Callbacks

**Incoming:**
- None. The only HTTP endpoints planned are the same-origin REST and SSE routes in `planning/PLAN.md` section 8 (`/api/*`, `/api/stream/*`).

**Outgoing:**
- None detected beyond the planned Massive REST polling and OpenRouter LLM calls.

---

*Integration audit: 2026-10-19*
