import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});

/**
 * Shared EventSource fake for every frontend test. Installed as the global
 * `EventSource` so code under test uses it unchanged; tests drive it through
 * `emitOpen`, `emitMessage` and `emitError`.
 */
class FakeEventSourceImpl {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;

  static instances: FakeEventSourceImpl[] = [];

  /** Forget every created instance (call from beforeEach). */
  static reset(): void {
    FakeEventSourceImpl.instances = [];
  }

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readyState: number = FakeEventSourceImpl.CONNECTING;
  readonly url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSourceImpl.instances.push(this);
  }

  close(): void {
    this.readyState = FakeEventSourceImpl.CLOSED;
  }

  /** Test helper: connection established. */
  emitOpen(): void {
    this.readyState = FakeEventSourceImpl.OPEN;
    this.onopen?.(new Event("open"));
  }

  /** Test helper: deliver one SSE message; `data` is JSON-stringified. */
  emitMessage(data: unknown): void {
    this.onmessage?.(new MessageEvent("message", { data: JSON.stringify(data) }));
  }

  /** Test helper: connection error; 0 = browser retries, 2 = fatal (closed). */
  emitError(nextState: number): void {
    this.readyState = nextState;
    this.onerror?.(new Event("error"));
  }
}

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

declare global {
  // eslint-disable-next-line no-var
  var FakeEventSource: typeof FakeEventSourceImpl;
  // Same name as the value above so tests can annotate instances as `FakeEventSource`.
  type FakeEventSource = FakeEventSourceImpl;
}

Object.assign(globalThis, {
  EventSource: FakeEventSourceImpl,
  FakeEventSource: FakeEventSourceImpl,
  ResizeObserver: ResizeObserverStub,
});

Object.defineProperty(window, "matchMedia", {
  writable: true,
  configurable: true,
  value: (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList,
});
