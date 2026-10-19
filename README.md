# FinAlly — AI Trading Workstation

A Bloomberg-style trading terminal with live prices, a simulated $10,000 portfolio, and an AI assistant that can analyze positions and execute trades from chat. Built entirely by coding agents as the capstone for an agentic AI coding course.

## Quick Start

Requires Docker.

```bash
# macOS / Linux
cp .env.example .env            # then set OPENROUTER_API_KEY
./scripts/start_mac.sh          # builds the image on first run
./scripts/stop_mac.sh
```

```powershell
# Windows PowerShell
Copy-Item .env.example .env     # then set OPENROUTER_API_KEY
.\scripts\start_windows.ps1     # builds the image on first run
.\scripts\stop_windows.ps1
```

Open http://localhost:8000. No login is needed.

- Pass `--build` (macOS/Linux) or `-Build` (Windows) to rebuild the image after code changes.
- If `.env` is missing, the start script creates it from `.env.example` and warns you. The app runs, but AI chat returns an error until `OPENROUTER_API_KEY` is set.
- The start scripts are idempotent: they replace any existing `finally` container. The stop scripts never delete your data.
- If PowerShell blocks the script, run it with `powershell -ExecutionPolicy Bypass -File scripts\start_windows.ps1`.

Equivalent manual commands:

```bash
docker build -t finally .
docker run -d --name finally -v finally-data:/app/db -p 8000:8000 --env-file .env finally
```

### Resetting the portfolio

Portfolio, watchlist and chat history live in the SQLite database in the `finally-data` Docker volume and survive restarts. To start over with $10,000 and the default watchlist:

```bash
./scripts/stop_mac.sh            # or .\scripts\stop_windows.ps1
docker volume rm finally-data
./scripts/start_mac.sh
```

## Environment Variables

Set these in `.env` in the project root (see `.env.example`):

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes, for chat | OpenRouter key for the AI chat |
| `MASSIVE_API_KEY` | No | Massive (Polygon.io) key for real market data. Needs a plan that includes stock snapshots (Starter or above); a free Basic key produces no prices. Leave empty to use the built-in simulator |
| `LLM_MOCK` | No | `true` returns deterministic mock LLM responses (used by E2E tests) |
| `DB_PATH` | No | SQLite file path. Default `db/finally.db` locally; the image sets `/app/db/finally.db` |
| `STATIC_DIR` | No | Frontend export directory. Default `backend/static` locally; the image sets `/app/static` |

### Real market data (Massive) outside market hours

With `MASSIVE_API_KEY` set, prices come from the Massive REST API, polled from the snapshot endpoint (`/v2/snapshot/locale/us/markets/stocks/tickers`). The free Basic plan refuses that endpoint: a free key is accepted, but no prices ever arrive, the watchlist stays blank, and every trade returns `price_unavailable`. Use a plan that includes snapshots (Starter or above), or leave the key empty to use the simulator. Outside US market hours (evenings, weekends, holidays) prices do not change, so there is no price flashing and sparklines stay flat. This is expected, not a bug. Tickers that do not exist are accepted onto the watchlist but never receive a price; trades in them return `price_unavailable`. Use the simulator (leave the key empty) for a lively demo.

## Architecture

One Docker container on port 8000:

- **Frontend**: Next.js (TypeScript, Tailwind) static export, served by FastAPI
- **Backend**: FastAPI, managed with `uv`
- **Database**: SQLite, created and seeded automatically on startup
- **Real-time**: Server-Sent Events at `/api/stream/prices`
- **AI**: LiteLLM → OpenRouter (`openai/gpt-oss-120b` on Cerebras) with structured outputs
- **Market data**: built-in GBM simulator by default, Massive API if a key is set

The `Dockerfile` is multi-stage: Node 20 builds the static frontend (`frontend/out`), then a Python 3.12 image installs the backend with `uv` and serves the export from `/app/static`. A container healthcheck polls `/api/health`.

## Development

Backend (from `backend/`):

```bash
uv sync --extra dev
uv run --extra dev pytest        # unit tests
uv run --extra dev ruff check .  # lint
uv run uvicorn app.main:app --reload --port 8000
```

Frontend (from `frontend/`):

```bash
npm install
npm test                         # unit tests
npm run dev                      # dev server (API calls go to /api/*)
npm run build                    # static export to frontend/out
```

To serve the built frontend from a local backend, set `STATIC_DIR` to the absolute path of `frontend/out`.

## E2E Tests

Playwright tests live in `test/` and run against the app container with `LLM_MOCK=true`:

```bash
docker compose -f test/docker-compose.test.yml up --build --abort-on-container-exit --exit-code-from playwright
docker compose -f test/docker-compose.test.yml down -v
```

Run from the repo root. Each run gets a fresh database. The HTML report and traces land in `test/playwright-report` and `test/test-results`.

To run against an app that is already running on port 8000:

```bash
cd test
npm ci
npx playwright install chromium
BASE_URL=http://localhost:8000 npx playwright test
```

## Project Structure

```
finally/
├── backend/     # FastAPI uv project (API, SQLite, market data, LLM chat)
├── frontend/    # Next.js static-export app
├── planning/    # Specification and agent reference docs
├── scripts/     # Docker start/stop scripts
├── test/        # Playwright E2E tests + docker-compose.test.yml
├── db/          # SQLite file location for local (non-Docker) runs
└── Dockerfile
```

## License

MIT — see [LICENSE](LICENSE).
