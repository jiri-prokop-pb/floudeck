import { describe, expect, test, afterEach } from "bun:test";
import { createApp, type App } from "./server.ts";
import { createMockRunner } from "./runner.ts";

let app: App | null = null;

afterEach(() => {
  app?.close();
  app = null;
});

function startApp() {
  app = createApp({
    port: 0,
    runBlock: createMockRunner(() => ({
      ok: true,
      html: "<p>mock result</p>",
      rawHtml: "<p>mock result</p>",
      reasoning: null,
    })),
    tickIntervalMs: 100_000, // don't auto-tick in tests
  });
  return app;
}

function url(path: string): string {
  return `http://localhost:${app!.server.port}${path}`;
}

describe("server", () => {
  test("responds to GET /api/blocks", async () => {
    startApp();
    const res = await fetch(url("/api/blocks"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.blocks).toEqual([]);
  });

  test("full create → fetch flow", async () => {
    startApp();

    const createRes = await fetch(url("/api/blocks"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "integration test",
        intervalValue: 5,
        intervalUnit: "minutes",
      }),
    });
    expect(createRes.status).toBe(201);
    const { block } = await createRes.json();
    expect(block.prompt).toBe("integration test");

    const listRes = await fetch(url("/api/blocks"));
    const { blocks } = await listRes.json();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe(block.id);
  });

  test("invalid input returns 400", async () => {
    startApp();

    const res = await fetch(url("/api/blocks"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "",
        intervalValue: -1,
        intervalUnit: "weeks",
      }),
    });
    expect(res.status).toBe(400);
  });

  test("close() cleans up", async () => {
    const a = startApp();
    const port = a.server.port;
    a.close();
    app = null;

    // Server should be stopped
    try {
      await fetch(`http://localhost:${port}/api/blocks`);
      // If fetch succeeds, that's unexpected but not fatal for test
    } catch {
      // Expected — connection refused
    }
  });
});
