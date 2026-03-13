import { afterEach, describe, expect, test } from "bun:test";
import { createSseBroadcaster, type SseBroadcaster } from "./sse.ts";

let sse: SseBroadcaster;

afterEach(() => {
  sse?.close();
});

describe("createSseBroadcaster", () => {
  test("addClient returns Response with SSE headers", () => {
    sse = createSseBroadcaster();
    const response = sse.addClient();
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("Connection")).toBe("keep-alive");
  });

  test("clientCount starts at 0", () => {
    sse = createSseBroadcaster();
    expect(sse.clientCount()).toBe(0);
  });

  test("addClient increments client count", () => {
    sse = createSseBroadcaster();
    sse.addClient();
    expect(sse.clientCount()).toBe(1);
  });

  test("close removes all clients", () => {
    sse = createSseBroadcaster();
    sse.addClient();
    sse.addClient();
    expect(sse.clientCount()).toBe(2);
    sse.close();
    expect(sse.clientCount()).toBe(0);
  });

  test("broadcast does not throw with no clients", () => {
    sse = createSseBroadcaster();
    expect(() =>
      sse.broadcast("block-updated", { blockId: 1, status: "success" }),
    ).not.toThrow();
  });

  test("broadcast sends formatted SSE frames", async () => {
    sse = createSseBroadcaster();
    const response = sse.addClient();
    sse.broadcast("block-updated", { blockId: 1, status: "success" });
    sse.close();

    const text = await response.text();
    expect(text).toContain("event: block-updated\n");
    expect(text).toContain('data: {"blockId":1,"status":"success"}\n');
  });
});
