# API Coverage — Massive (Polygon.io) REST, `massive` Python SDK 2.2.0

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Scope: Phase 1 fixes the existing Massive integration (MKT-01 snapshot parsing, MKT-05 previous-close baseline, fail-soft polling) in `backend/app/market/massive_client.py`, plan 01-04 Task 3. The capability list below is the stock-market surface of the installed `massive.RESTClient` (method names read from `massive/rest/*.py`). The LLM integration (LiteLLM -> OpenRouter) belongs to Phase 3 and is not part of this phase.

| capability | decision | reason |
|---|---|---|
| get_snapshot_all (stocks, watched tickers) | INTEGRATE | |
| snapshot prev_day.close day-change baseline | INTEGRATE | |
| snapshot price fallback chain | INTEGRATE | |
| snapshot sip_timestamp / updated timestamps | INTEGRATE | |
| get_snapshot_ticker | OPT-OUT | not needed — get_snapshot_all returns every watched ticker in one call, which fits the 5 calls/min free-tier budget |
| get_previous_close_agg | OPT-OUT | not needed — prev_day.close in the snapshot already provides the previous close |
| get_last_trade / get_last_quote | OPT-OUT | not needed — the snapshot carries the last trade; quotes are not displayed |
| aggregates (get_aggs, list_aggs, grouped, open-close) | OPT-OUT | not needed yet — chart history is browser-only by decision D-20; server-side history is v2 ENH-01 |
| list_trades / list_quotes | OPT-OUT | not needed — tick-level history is not part of the product |
| ticker reference (list_tickers, details, types, events) | OPT-OUT | not needed yet — symbol validation in Massive mode is v2 ENH-02 (PLAN 13.2 item 11) |
| get_market_status / get_market_holidays | OPT-OUT | not needed — static prices outside market hours are documented as expected behavior (PLAN 13.2 item 14) |
| get_snapshot_direction / list_universal_snapshots | OPT-OUT | not needed — the app only prices the user's watchlist |
| options, forex, crypto, indices, futures endpoints | OPT-OUT | explicitly out of scope — the product trades US stocks only (get_snapshot_option, options chain, indices, crypto book, forex quotes, currency conversion, futures) |
| corporate actions and filings | OPT-OUT | not needed — no corporate-action or filing features in the spec (dividends, splits, short interest/volume, risk-factor filings, conditions, exchanges) |
| news, financials, benzinga, economy, etf, tmx, indicators | OPT-OUT | not needed — no news, fundamentals or technical-indicator features in the spec |
| WebSocket streaming client | OPT-OUT | explicitly out of scope — PLAN section 6 mandates REST polling, not WebSocket |

Verification note: the user has no Massive key (RESEARCH OQ-3). Integrated capabilities are proven by unit tests built from real `TickerSnapshot.from_dict` models; a live check needs a paid plan because the full-market snapshot is not on the free Stocks Basic tier.
