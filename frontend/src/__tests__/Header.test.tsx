import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "@/components/Header";
import { __resetPriceStoreForTests, connectPriceStream } from "@/lib/priceStore";

function pendingFetch(): void {
  vi.stubGlobal("fetch", vi.fn(() => new Promise<Response>(() => {})));
}

function currentSource(): FakeEventSource {
  const source = FakeEventSource.instances.at(-1);
  if (!source) throw new Error("no EventSource was created");
  return source;
}

describe("Header wordmark and connection indicator", () => {
  beforeEach(() => {
    __resetPriceStoreForTests();
    FakeEventSource.reset();
    pendingFetch();
  });

  afterEach(() => {
    __resetPriceStoreForTests();
    vi.unstubAllGlobals();
  });

  it("shows Fin and Ally with Ally in the accent color", () => {
    render(<Header />);
    expect(screen.getByText("Fin")).toBeInTheDocument();
    expect(screen.getByText("Ally")).toHaveClass("text-accent");
  });

  it("reads CONNECTING before the stream opens", () => {
    connectPriceStream();
    render(<Header />);
    expect(screen.getByRole("status")).toHaveTextContent("CONNECTING");
  });

  it("reads LIVE after the stream opens", () => {
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    expect(screen.getByRole("status")).toHaveTextContent("LIVE");
  });

  it("reads RECONNECTING when the browser is retrying after an open", () => {
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    act(() => currentSource().emitError(FakeEventSource.CONNECTING));
    expect(screen.getByRole("status")).toHaveTextContent("RECONNECTING");
  });

  it("reads OFFLINE when the stream is closed", () => {
    connectPriceStream();
    render(<Header />);
    act(() => currentSource().emitOpen());
    act(() => currentSource().emitError(FakeEventSource.CLOSED));
    expect(screen.getByRole("status")).toHaveTextContent("OFFLINE");
  });
});
