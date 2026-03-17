import {
  afterEach,
  beforeEach,
  describe,
  expect,
  spyOn,
  test,
} from "bun:test";
import { createMockRunner } from "./runner.ts";
import { type App, createApp } from "./server.ts";

let app: App | null = null;

beforeEach(() => {});

afterEach(() => {
  app?.close();
  app = null;
});

function startApp() {
  app = createApp({
    port: 0, // OS-assigned free port
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
  if (!app) {
    throw new Error("App not started");
  }

  return `http://localhost:${app.server.port}${path}`;
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  if (!app) {
    throw new Error("App not started");
  }

  return await app.server.fetch(new Request(url(path), init));
}

describe("server", () => {
  test("responds to GET /api/blocks", async () => {
    startApp();
    const res = await request("/api/blocks");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.blocks).toEqual([]);
  });

  test("full create → fetch flow", async () => {
    startApp();

    const createRes = await request("/api/blocks", {
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

    const listRes = await request("/api/blocks");
    const { blocks } = await listRes.json();
    expect(blocks).toHaveLength(1);
    expect(blocks[0].id).toBe(block.id);
  });

  test("invalid input returns 400", async () => {
    startApp();

    const res = await request("/api/blocks", {
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

  test("close() stops the server", () => {
    const a = startApp();
    const stopSpy = spyOn(a.server, "stop");

    a.close();
    app = null;

    expect(stopSpy).toHaveBeenCalled();
  });
});
