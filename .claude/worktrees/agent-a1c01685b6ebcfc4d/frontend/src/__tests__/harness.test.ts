import { beforeEach, describe, expect, it, vi } from "vitest";

describe("shared test harness", () => {
  beforeEach(() => {
    FakeEventSource.reset();
  });

  it("registers a FakeEventSource in CONNECTING when EventSource is constructed", () => {
    const es = new EventSource("/x");
    expect(FakeEventSource.instances).toHaveLength(1);
    expect(FakeEventSource.instances[0]).toBe(es);
    expect(es.readyState).toBe(FakeEventSource.CONNECTING);
    expect(es.url).toBe("/x");
  });

  it("emitOpen sets OPEN and calls onopen", () => {
    const es = new EventSource("/x") as unknown as FakeEventSource;
    const onopen = vi.fn();
    es.onopen = onopen;
    es.emitOpen();
    expect(es.readyState).toBe(FakeEventSource.OPEN);
    expect(onopen).toHaveBeenCalledTimes(1);
  });

  it("emitMessage delivers JSON-stringified data to onmessage", () => {
    const es = new EventSource("/x") as unknown as FakeEventSource;
    const onmessage = vi.fn();
    es.onmessage = onmessage;
    es.emitMessage({ a: 1 });
    expect(onmessage).toHaveBeenCalledTimes(1);
    expect(onmessage.mock.calls[0][0].data).toBe('{"a":1}');
  });

  it("emitError(2) sets CLOSED and calls onerror", () => {
    const es = new EventSource("/x") as unknown as FakeEventSource;
    const onerror = vi.fn();
    es.onerror = onerror;
    es.emitError(2);
    expect(es.readyState).toBe(FakeEventSource.CLOSED);
    expect(onerror).toHaveBeenCalledTimes(1);
  });

  it("close() sets CLOSED", () => {
    const es = new EventSource("/x");
    es.close();
    expect(es.readyState).toBe(FakeEventSource.CLOSED);
  });

  it("reset() empties instances", () => {
    new EventSource("/a");
    new EventSource("/b");
    expect(FakeEventSource.instances).toHaveLength(2);
    FakeEventSource.reset();
    expect(FakeEventSource.instances).toHaveLength(0);
  });

  it("stubs ResizeObserver", () => {
    const ro = new ResizeObserver(() => {});
    expect(typeof ro.observe).toBe("function");
    expect(typeof ro.disconnect).toBe("function");
    ro.observe(document.body);
    ro.disconnect();
  });

  it("stubs matchMedia with matches false", () => {
    expect(window.matchMedia("(min-width: 1200px)").matches).toBe(false);
  });
});
