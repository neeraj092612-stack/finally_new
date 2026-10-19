"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/api";
import { formatPrice, formatTime } from "@/lib/format";
import type { ChatActions, ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  loadHistory: () => Promise<ChatMessage[]>;
  send: (message: string) => Promise<ChatMessage>;
  /** Called after an assistant reply that carried at least one action. */
  onActions: (actions: ChatActions) => void;
  collapsed: boolean;
  onToggle: () => void;
}

export function hasActions(actions: ChatActions | null): actions is ChatActions {
  return !!actions && (actions.trades.length > 0 || actions.watchlist_changes.length > 0);
}

export default function ChatPanel({ loadHistory, send, onActions, collapsed, onToggle }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    loadHistory()
      .then((history) => {
        if (!cancelled) setMessages((current) => (current.length ? current : history));
      })
      .catch(() => {
        // history is a convenience; the panel still works without it
      });
    return () => {
      cancelled = true;
    };
  }, [loadHistory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading, collapsed]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const local: ChatMessage = {
      id: `local-${Date.now()}`,
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
      actions: null,
    };
    setMessages((m) => [...m, local]);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const reply = await send(text);
      setMessages((m) => [...m, reply]);
      if (hasActions(reply.actions)) onActions(reply.actions);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The assistant is unavailable right now.");
    } finally {
      setLoading(false);
    }
  };

  if (collapsed) {
    return (
      <aside data-testid="chat-panel" data-collapsed="true" className="panel flex h-full w-10 flex-col items-center py-2">
        <button
          type="button"
          onClick={onToggle}
          aria-label="Open AI assistant"
          title="Open AI assistant"
          className="rounded-sm px-1 py-2 text-accent hover:bg-panel-2"
        >
          <span className="block text-sm">«</span>
          <span className="mt-2 block text-[10px] uppercase tracking-[0.2em] [writing-mode:vertical-rl]">
            AI Assistant
          </span>
        </button>
      </aside>
    );
  }

  return (
    <aside data-testid="chat-panel" data-collapsed="false" className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <h2 className="panel-title">
          <span className="text-accent">◆</span> FinAlly Assistant
        </h2>
        <button
          type="button"
          onClick={onToggle}
          aria-label="Collapse AI assistant"
          title="Collapse"
          className="rounded-sm px-1.5 text-sm text-muted hover:bg-panel-2 hover:text-text"
        >
          »
        </button>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {messages.length === 0 && !loading && (
          <div className="space-y-2 text-xs text-muted">
            <p>Ask about your portfolio, or tell me to trade.</p>
            <ul className="space-y-1 text-faint">
              <li>“How concentrated is my portfolio?”</li>
              <li>“Buy 5 shares of NVDA”</li>
              <li>“Add PYPL to my watchlist”</li>
            </ul>
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {loading && (
          <div data-testid="chat-loading" role="status" aria-label="Assistant is thinking" className="flex items-center gap-2 text-xs text-muted">
            <span className="loading-dots num text-accent">
              <span>●</span>
              <span>●</span>
              <span>●</span>
            </span>
            Thinking…
          </div>
        )}
        {error && (
          <p role="alert" data-testid="chat-error" className="rounded-sm border border-down/40 bg-down/10 px-2 py-1.5 text-xs text-down">
            {error}
          </p>
        )}
      </div>

      <form onSubmit={submit} className="flex gap-1.5 border-t border-line p-2">
        <input
          data-testid="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message FinAlly…"
          aria-label="Chat message"
          className="min-w-0 flex-1 rounded-sm border border-line bg-bg px-2 py-1.5 text-xs outline-none placeholder:text-faint focus:border-blue"
        />
        <button
          data-testid="chat-send-button"
          type="submit"
          disabled={loading || !input.trim()}
          className="rounded-sm bg-purple px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-hi disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </aside>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div data-testid="chat-message" data-role={message.role} className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[92%] whitespace-pre-wrap rounded-md px-2.5 py-1.5 text-xs leading-relaxed ${
          isUser ? "bg-blue/15 text-text" : "border border-line bg-panel-2 text-text"
        }`}
      >
        {message.content}
      </div>
      {message.actions && <ActionList actions={message.actions} />}
      <span className="mt-0.5 text-[9px] text-faint">{formatTime(message.created_at)}</span>
    </div>
  );
}

function ActionList({ actions }: { actions: ChatActions }) {
  if (!hasActions(actions)) return null;
  return (
    <ul className="mt-1 w-full max-w-[92%] space-y-1">
      {actions.watchlist_changes.map((a, i) => (
        <ActionItem
          key={`w${i}`}
          status={a.status}
          label={`${a.action === "add" ? "Watch" : "Unwatch"} ${a.ticker}`}
          error={a.error?.message}
        />
      ))}
      {actions.trades.map((t, i) => (
        <ActionItem
          key={`t${i}`}
          status={t.status}
          label={`${t.side === "buy" ? "Bought" : "Sold"} ${t.quantity} ${t.ticker}${
            t.price != null ? ` @ $${formatPrice(t.price)}` : ""
          }`}
          failedLabel={`${t.side === "buy" ? "Buy" : "Sell"} ${t.quantity} ${t.ticker}`}
          error={t.error?.message}
        />
      ))}
    </ul>
  );
}

function ActionItem({
  status,
  label,
  failedLabel,
  error,
}: {
  status: "executed" | "failed";
  label: string;
  failedLabel?: string;
  error?: string;
}) {
  const ok = status === "executed";
  return (
    <li
      data-testid="chat-action"
      data-status={status}
      className={`num rounded-sm border px-2 py-1 text-[11px] ${
        ok ? "border-up/30 bg-up/10 text-up" : "border-down/30 bg-down/10 text-down"
      }`}
    >
      <span className="mr-1">{ok ? "✓" : "✕"}</span>
      {ok ? label : failedLabel ?? label}
      {!ok && error && <span className="block font-sans text-[10px] text-down/80">{error}</span>}
    </li>
  );
}
