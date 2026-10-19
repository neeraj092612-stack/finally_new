import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api";
import type { ChatMessage } from "@/lib/types";
import { chatHistory } from "@/test/fixtures";
import ChatPanel from "./ChatPanel";

function setup(overrides: Partial<React.ComponentProps<typeof ChatPanel>> = {}) {
  const props: React.ComponentProps<typeof ChatPanel> = {
    loadHistory: vi.fn().mockResolvedValue([]),
    send: vi.fn(),
    onActions: vi.fn(),
    collapsed: false,
    onToggle: vi.fn(),
    ...overrides,
  };
  render(<ChatPanel {...props} />);
  return props;
}

describe("ChatPanel", () => {
  it("loads and renders history with inline action outcomes", async () => {
    setup({ loadHistory: vi.fn().mockResolvedValue(chatHistory) });
    const messages = await screen.findAllByTestId("chat-message");
    expect(messages).toHaveLength(2);
    expect(messages[0]).toHaveAttribute("data-role", "user");
    expect(messages[1]).toHaveAttribute("data-role", "assistant");

    const actions = screen.getAllByTestId("chat-action");
    expect(actions).toHaveLength(3);
    expect(actions[0]).toHaveAttribute("data-status", "executed");
    expect(actions[1]).toHaveTextContent("Bought 5 PYPL @ $71.30");
    expect(actions[2]).toHaveAttribute("data-status", "failed");
    expect(actions[2]).toHaveTextContent("Need $125,000.00");
  });

  it("shows a loading indicator while waiting, then the reply", async () => {
    let resolve!: (m: ChatMessage) => void;
    const send = vi.fn(() => new Promise<ChatMessage>((r) => (resolve = r)));
    const props = setup({ send });

    await userEvent.type(screen.getByTestId("chat-input"), "how am I doing?");
    await userEvent.click(screen.getByTestId("chat-send-button"));

    expect(send).toHaveBeenCalledWith("how am I doing?");
    expect(screen.getByTestId("chat-loading")).toBeInTheDocument();
    expect(screen.getByTestId("chat-message")).toHaveAttribute("data-role", "user");
    expect(screen.getByTestId("chat-input")).toHaveValue("");

    resolve({
      id: "a1",
      role: "assistant",
      content: "Your portfolio is worth $10,000.00.",
      created_at: "2026-10-04T14:05:10Z",
      actions: { watchlist_changes: [], trades: [] },
    });

    await waitFor(() => expect(screen.queryByTestId("chat-loading")).not.toBeInTheDocument());
    expect(screen.getAllByTestId("chat-message")[1]).toHaveTextContent("Your portfolio is worth");
    expect(props.onActions).not.toHaveBeenCalled();
  });

  it("notifies the parent when a reply carries actions", async () => {
    const reply = chatHistory[1];
    const props = setup({ send: vi.fn().mockResolvedValue(reply) });
    await userEvent.type(screen.getByTestId("chat-input"), "Buy 5 shares of PYPL{enter}");
    await waitFor(() => expect(props.onActions).toHaveBeenCalledWith(reply.actions));
  });

  it("shows llm_error inline and keeps the user message", async () => {
    setup({ send: vi.fn().mockRejectedValue(new ApiError("llm_error", "The assistant failed to respond.", 502)) });
    await userEvent.type(screen.getByTestId("chat-input"), "hello{enter}");
    expect(await screen.findByTestId("chat-error")).toHaveTextContent("The assistant failed to respond.");
    expect(screen.getByTestId("chat-message")).toHaveTextContent("hello");
    expect(screen.queryByTestId("chat-loading")).not.toBeInTheDocument();
  });

  it("can be collapsed", async () => {
    const props = setup();
    await userEvent.click(screen.getByLabelText("Collapse AI assistant"));
    expect(props.onToggle).toHaveBeenCalled();
  });
});
