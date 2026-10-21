---
phase: "01"
slug: "live-market-terminal"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-10-20"
---

# Phase 01 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Browser -> FastAPI (/api, SSE, static) | Unauthenticated single-user app; port published on 127.0.0.1 only | Simulated prices and portfolio (low) |
| Host network -> container port | Who can reach the unauthenticated app | HTTP requests (low) |
| Massive REST API -> backend | Third-party market data (optional, paid key) | Prices; API key in outbound requests (high for the key) |
| .env -> container environment | Secrets passed at run time via --env-file | OPENROUTER_API_KEY, MASSIVE_API_KEY (high) |
| npm / PyPI registries -> build | Third-party packages installed at build time | Code (supply chain) |
| Scripts -> Docker volumes | Where user data could be lost | SQLite database (medium) |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-01-01 (01-01) | Tampering | StaticFiles mount at / (path traversal) | medium | mitigate | Serve the export only through Starlette `StaticFiles(directory, html=True)` (safe-path resolution), mounted after every API router; no hand-rolled file route | closed |
| T-01-02 (01-01) | Tampering | SQL in db/ and services/watchlist.py | medium | mitigate | Every statement uses `?` placeholders; `USER_ID` is a module constant; no request data reaches SQL in this plan | closed |
| T-01-03 (01-01) | Information disclosure | /api/health, /api/stream/prices | low | accept | Data is simulated prices for a single local user; loopback-only port binding is enforced by the start scripts in plan 01-13 | closed |
| T-01-04 (01-01) | Denial of service | SSE generator per client | low | accept | Single user; each generator sleeps 500 ms between polls; one uvicorn worker shares one cache | closed |
| T-01-05 (01-01) | Tampering | DB_PATH / STATIC_DIR env values | low | accept | Operator-controlled configuration only; values are stripped and never derived from HTTP input | closed |
| T-01-SC (01-02) | Tampering | npm installs (frontend) | high | mitigate | Blocking-human checkpoint (Task 1) before any install; exact pins via --save-exact; committed package-lock.json; Docker uses npm ci so lock drift fails the build | closed |
| T-01-06 (01-02) | Information disclosure | next.config.ts dev rewrites | low | accept | Rewrites exist only when NODE_ENV is development; the static export has no server and no proxy | closed |
| T-01-07 (01-02) | Tampering | Agent-rule files written by next dev | low | mitigate | agentRules: false plus .gitignore entries for frontend/AGENTS.md and frontend/CLAUDE.md so no generated agent instructions enter the repo | closed |
| T-01-24 (01-03) | Tampering | PriceCache.update baseline and raw fields | low | mitigate | The baseline comes only from the first cached price or an explicit source value; a None or 0 reference yields None (never a division by zero or a fabricated 0.0); raw fields stay internal and are never serialized by to_dict() (test-asserted) | closed |
| T-01-25 (01-03) | Denial of service | SimulatorDataSource pending queue | low | accept | Single local user; the queue is de-duplicated and emptied at start, so it cannot grow beyond the set of requested tickers | closed |
| T-01-26 (01-04) | Information disclosure | Font and asset loading | low | mitigate | JetBrains Mono is bundled from @fontsource into `_next/static/media`; the page references no third-party CDN, so opening it leaks nothing to other origins (gate: no fonts.googleapis reference) | closed |
| T-01-08 (01-05) | Tampering | priceStore onmessage parsing | low | mitigate | JSON.parse in try/catch; entries with non-finite prices are dropped; only watched tickers are ingested once the watchlist is known | closed |
| T-01-10 (01-05) | Denial of service | Unbounded tick buffers | low | mitigate | Per-ticker cap of 50,000 points trimmed in 1,000-point chunks; session stats are running values, not rescans | closed |
| T-01-27 (01-06) | Tampering | SQL in services/watchlist.py and services/portfolio.py | medium | mitigate | Every statement uses `?` placeholders; `USER_ID` is the module constant; neither route reads request input, so no client data reaches SQL | closed |
| T-01-28 (01-06) | Information disclosure | GET /api/portfolio | low | accept | Simulated money for a single local user; published on 127.0.0.1 only by the start scripts (plan 01-13) | closed |
| T-01-11 (01-07) | Information disclosure | MassiveDataSource failure logging | high | mitigate | Log only `type(e).__name__` and the message with the API key replaced by `***`; never log request objects or headers; caplog test asserts the key never appears | closed |
| T-01-13 (01-07) | Denial of service | Massive poll loop on persistent failure | low | mitigate | Exponential backoff capped at 120 s keeps a failing key from hammering the 5 calls/min limit; one error log per streak prevents log flooding | closed |
| T-01-14 (01-07) | Tampering | Massive snapshot parsing | low | mitigate | Only positive numeric prices are accepted; a malformed snapshot is skipped, never crashes the poller | closed |
| T-01-09 (01-08) | Tampering | Rendering server data in the header | low | mitigate | Render only through React text nodes; no dangerouslySetInnerHTML anywhere in the frontend | closed |
| T-01-29 (01-08) | Information disclosure | Header error state | low | mitigate | The header shows a fixed caption on failure and never renders server exception text or response bodies | closed |
| T-01-12 (01-09) | Information disclosure | errors.py handlers | medium | mitigate | Responses carry fixed user-facing messages; no tracebacks or internal exception text in any envelope | closed |
| T-01-SC (01-09) | Tampering | uv lock adding httpx (PyPI) | high | mitigate | Approved at the plan 01-02 blocking-human checkpoint; pinned with hashes in uv.lock; dev extra only, the Docker image installs without extras | closed |
| T-01-15 (01-10) | Tampering | Ticker text in rows, titles and aria-labels | low | mitigate | Rendered only as React text and attributes (escaped); no dangerouslySetInnerHTML; long symbols truncated | closed |
| T-01-16 (01-10) | Denial of service | Sparkline recomputation per tick | low | accept | Window is capped at 600 points per ticker and 10 to 20 rows; cost is negligible for a single user | closed |
| T-01-17 (01-11) | Information disclosure | Image layers (secrets baked in) | high | mitigate | .dockerignore excludes .env, .env.*, .claude, .planning; targeted COPY of backend/app, lockfiles and the export only; verified with a `test ! -e /app/.env` run | closed |
| T-01-21 (01-11) | Elevation of privilege | Container runs as root | low | accept | Local single-user demo at ASVS L1; a non-root user needs volume ownership handling and is optional hardening | closed |
| T-01-SC (01-11) | Tampering | Base images and in-image installs | medium | mitigate | uv image pinned to 0.11.7; `npm ci` from the committed lockfile; `uv sync --frozen` from uv.lock; no dev extras in the runtime | closed |
| T-01-30 (01-12) | Tampering | Ticker text in the chart title and the data-ticker selector | low | mitigate | Ticker text renders only as React text; the focus lookup uses a ticker taken from the rendered entries (backend-normalized to `^[A-Z][A-Z0-9.]{0,9}$`), never free user input | closed |
| T-01-18 (01-13) | Elevation of privilege | Published port on all interfaces | high | mitigate | Both start scripts publish `127.0.0.1:PORT:8000`; verified with `docker port` | closed |
| T-01-19 (01-13) | Tampering | User data loss by scripts or verification | medium | mitigate | stop scripts use `docker rm -f` without the volume flag; no script removes volumes; verification uses a separate test container and volume and checks `finally-data` still exists | closed |
| T-01-20 (01-13) | Information disclosure | Scripts echoing .env contents | medium | mitigate | Scripts only pass `--env-file .env`; they never print, parse or copy it | closed |
| T-01-22 (01-14) | Denial of service | Chart growth over a long session | low | mitigate | Buffers capped at 50,000 points per ticker (plan 01-05), points collapsed per second, live ticks applied with series.update (no full re-render) | closed |
| T-01-23 (01-14) | Elevation of privilege | Test container left running for the human check | low | mitigate | Published on 127.0.0.1 only by the start script; uses the separate test volume; stop with `FINALLY_CONTAINER=finally-phase1-test bash scripts/stop_mac.sh` | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

Evidence (L1, grep-depth, 2026-10-20): every `mitigate` control above was found in the merged code on branch finally-gst (StaticFiles mount; `?`-placeholder SQL only; exact npm pins + committed lockfile + `npm ci`; `agentRules: false`; baseline/raw fields not serialized; bundled @fontsource, no font CDN; guarded JSON.parse + finite-price filter; 50,000-point buffer cap; API-key redaction + caplog test; 120 s backoff; positive-price parsing; no `dangerouslySetInnerHTML` anywhere; fixed header error caption; fixed-message error envelopes; httpx dev-only + `uv sync --frozen`; .dockerignore excludes .env/.claude/.planning; pinned uv image; 127.0.0.1-only publish in both start scripts; no volume removal in any script, `finally-data` intact; scripts never read .env; `series.update` for live ticks). No SUMMARY reported new threat flags. Note: code review WR-01 (uncaught exceptions return Starlette plain-text 500) does not leak internals, so T-01-12 holds; WR-05 (root container) is T-01-21, accepted.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-01-01 | T-01-03 | Data is simulated prices for a single local user; loopback-only port binding is enforced by the start scripts in plan 01-13 | plan 01-01 threat model (user-approved phase plan) | 2026-10-20 |
| AR-01-02 | T-01-04 | Single user; each generator sleeps 500 ms between polls; one uvicorn worker shares one cache | plan 01-01 threat model (user-approved phase plan) | 2026-10-20 |
| AR-01-03 | T-01-05 | Operator-controlled configuration only; values are stripped and never derived from HTTP input | plan 01-01 threat model (user-approved phase plan) | 2026-10-20 |
| AR-01-04 | T-01-06 | Rewrites exist only when NODE_ENV is development; the static export has no server and no proxy | plan 01-02 threat model (user-approved phase plan) | 2026-10-20 |
| AR-01-05 | T-01-25 | Single local user; the queue is de-duplicated and emptied at start, so it cannot grow beyond the set of requested tickers | plan 01-03 threat model (user-approved phase plan) | 2026-10-20 |
| AR-01-06 | T-01-28 | Simulated money for a single local user; published on 127.0.0.1 only by the start scripts (plan 01-13) | plan 01-06 threat model (user-approved phase plan) | 2026-10-20 |
| AR-01-07 | T-01-16 | Window is capped at 600 points per ticker and 10 to 20 rows; cost is negligible for a single user | plan 01-10 threat model (user-approved phase plan) | 2026-10-20 |
| AR-01-08 | T-01-21 | Local single-user demo at ASVS L1; a non-root user needs volume ownership handling and is optional hardening | plan 01-11 threat model (user-approved phase plan) | 2026-10-20 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-20 | 33 | 33 | 0 | /gsd-secure-phase 01 (orchestrator, L1 grep verification) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
