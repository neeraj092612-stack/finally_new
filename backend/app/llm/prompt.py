"""System prompt and message assembly for the chat LLM."""

from __future__ import annotations

import json

SYSTEM_PROMPT = """\
You are FinAlly, an AI trading assistant inside a simulated trading workstation. \
The user trades a virtual portfolio with fake money; there is no real financial risk.

What you do:
- Analyze the user's portfolio: composition, risk concentration, unrealized P&L, cash.
- Suggest trades with brief, data-driven reasoning.
- Execute trades when the user asks for them or agrees to your suggestion.
- Manage the watchlist proactively (add tickers the user is interested in, remove ones they no longer want).
- Be concise. Use numbers from the portfolio context. No disclaimers about financial advice.

Execution rules (actions you list are executed automatically, without confirmation):
- Market orders only, filled instantly at the current price. Quantities are whole shares (positive integers).
- A trade is only possible for a ticker that is on the watchlist and has a price. To trade a ticker \
that is not on the watchlist, include a watchlist "add" for it in the same response.
- Buys need enough cash (quantity x price <= cash). Sells need enough shares held.
- A ticker with an open position cannot be removed from the watchlist; sell the whole position first \
(in the same response is fine — removals run after trades).
- Actions run in this order: watchlist additions, then trades in the order you give, then watchlist removals.
- Only include actions you actually intend to execute now. When just discussing or suggesting, leave \
the arrays empty.
- Results of earlier actions (including failures) appear in the conversation history; take them into account.

Always respond with JSON matching the schema: "message" (your reply to the user), "trades" \
(array, may be empty) and "watchlist_changes" (array, may be empty).
"""

HISTORY_LIMIT = 20


def format_context(portfolio: dict, watchlist: list[dict]) -> str:
    """Render the live portfolio and watchlist as a compact context block."""
    lines = [
        "Current portfolio (live prices):",
        f"- Cash: ${portfolio['cash_balance']:,.2f}",
        f"- Positions value: ${portfolio['positions_value']:,.2f}",
        f"- Total value: ${portfolio['total_value']:,.2f} (started at $10,000.00)",
        f"- Unrealized P&L: ${portfolio['unrealized_pnl']:,.2f}",
    ]
    if portfolio["positions"]:
        lines.append("Positions:")
        for p in portfolio["positions"]:
            lines.append(
                f"- {p['ticker']}: {p['quantity']} sh, avg cost ${p['avg_cost']:,.2f}, "
                f"price ${p['current_price']:,.2f}, value ${p['market_value']:,.2f}, "
                f"P&L ${p['unrealized_pnl']:,.2f} ({p['unrealized_pnl_percent']:.2f}%)"
            )
    else:
        lines.append("Positions: none")

    lines.append("Watchlist:")
    for w in watchlist:
        if w["price"] is None:
            lines.append(f"- {w['ticker']}: no price yet")
        else:
            day = w.get("day_change_percent")
            day_txt = f", {day:+.2f}% since session start" if day is not None else ""
            lines.append(f"- {w['ticker']}: ${w['price']:,.2f}{day_txt}")
    if not watchlist:
        lines.append("- (empty)")
    return "\n".join(lines)


def _history_entry(msg: dict) -> dict:
    content = msg["content"]
    actions = msg.get("actions")
    if msg["role"] == "assistant" and actions and (actions.get("trades") or actions.get("watchlist_changes")):
        content += "\n\n[Action results: " + json.dumps(actions, separators=(",", ":")) + "]"
    return {"role": msg["role"], "content": content}


def build_messages(
    portfolio: dict, watchlist: list[dict], history: list[dict], user_message: str
) -> list[dict]:
    """System prompt + live context, prior turns (oldest first), then the new user message."""
    return [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": format_context(portfolio, watchlist)},
        *(_history_entry(m) for m in history),
        {"role": "user", "content": user_message},
    ]
