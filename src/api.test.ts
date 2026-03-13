import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { createRouter } from "./api.ts";
import { initDb } from "./db.ts";
import { createSseBroadcaster, type SseBroadcaster } from "./sse.ts";

let db: Database;
let sse: SseBroadcaster;
let router: (req: Request) => Promise<Response | null>;
let triggeredIds: number[];

beforeEach(() => {
  db = initDb();
  sse = createSseBroadcaster();
  triggeredIds = [];
  router = createRouter({
    db,
    sse,
    triggerRun: (id) => triggeredIds.push(id),
  });
});

function req(method: string, path: string, body?: unknown): Request {
  const init: RequestInit = { method };
  if (body) {
    init.body = JSON.stringify(body);
    init.headers = { "Content-Type": "application/json" };
  }
  return new Request(`http://localhost${path}`, init);
}

describe("GET /api/blocks", () => {
  test("returns empty list", async () => {
    const res = await router(req("GET", "/api/blocks"));
    expect(res).not.toBeNull();
    const data = await res!.json();
    expect(data.ok).toBe(true);
    expect(data.blocks).toEqual([]);
  });

  test("returns populated list", async () => {
    await router(
      req("POST", "/api/blocks", {
        prompt: "test",
        intervalValue: 5,
        intervalUnit: "minutes",
      }),
    );
    const res = await router(req("GET", "/api/blocks"));
    const data = await res!.json();
    expect(data.blocks).toHaveLength(1);
    expect(data.blocks[0].prompt).toBe("test");
  });
});

describe("GET /api/blocks/:id", () => {
  test("returns block when found", async () => {
    const createRes = await router(
      req("POST", "/api/blocks", {
        prompt: "find me",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    const created = await createRes!.json();
    const res = await router(req("GET", `/api/blocks/${created.block.id}`));
    const data = await res!.json();
    expect(data.ok).toBe(true);
    expect(data.block.prompt).toBe("find me");
  });

  test("returns 404 for missing id", async () => {
    const res = await router(req("GET", "/api/blocks/999"));
    expect(res!.status).toBe(404);
  });
});

describe("POST /api/blocks", () => {
  test("creates valid block", async () => {
    const res = await router(
      req("POST", "/api/blocks", {
        prompt: "new block",
        intervalValue: 10,
        intervalUnit: "minutes",
      }),
    );
    expect(res!.status).toBe(201);
    const data = await res!.json();
    expect(data.ok).toBe(true);
    expect(data.block.prompt).toBe("new block");
    expect(triggeredIds).toContain(data.block.id);
  });

  test("rejects invalid input", async () => {
    const res = await router(
      req("POST", "/api/blocks", {
        prompt: "",
        intervalValue: 0,
        intervalUnit: "weeks",
      }),
    );
    expect(res!.status).toBe(400);
  });

  test("rejects missing prompt", async () => {
    const res = await router(
      req("POST", "/api/blocks", {
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    expect(res!.status).toBe(400);
  });
});

describe("POST /api/blocks/:id/update", () => {
  test("updates valid block", async () => {
    const createRes = await router(
      req("POST", "/api/blocks", {
        prompt: "old",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    const { block } = await createRes!.json();

    const res = await router(
      req("POST", `/api/blocks/${block.id}/update`, {
        prompt: "new",
        intervalValue: 2,
        intervalUnit: "days",
      }),
    );
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.block.prompt).toBe("new");
    expect(data.block.interval_value).toBe(2);
  });

  test("returns 404 for missing id", async () => {
    const res = await router(
      req("POST", "/api/blocks/999/update", {
        prompt: "x",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    expect(res!.status).toBe(404);
  });
});

describe("POST /api/blocks/:id/delete", () => {
  test("deletes existing block", async () => {
    const createRes = await router(
      req("POST", "/api/blocks", {
        prompt: "delete me",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    const { block } = await createRes!.json();

    const res = await router(req("POST", `/api/blocks/${block.id}/delete`));
    expect(res!.status).toBe(200);
    const data = await res!.json();
    expect(data.ok).toBe(true);

    // Verify deleted
    const getRes = await router(req("GET", `/api/blocks/${block.id}`));
    expect(getRes!.status).toBe(404);
  });

  test("returns 404 for missing id", async () => {
    const res = await router(req("POST", "/api/blocks/999/delete"));
    expect(res!.status).toBe(404);
  });
});

describe("POST /api/blocks/:id/refresh", () => {
  test("sets next_run_at and triggers run", async () => {
    const createRes = await router(
      req("POST", "/api/blocks", {
        prompt: "refresh me",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    const { block } = await createRes!.json();
    triggeredIds = [];

    const res = await router(req("POST", `/api/blocks/${block.id}/refresh`));
    expect(res!.status).toBe(200);
    expect(triggeredIds).toContain(block.id);
  });

  test("returns 404 for missing id", async () => {
    const res = await router(req("POST", "/api/blocks/999/refresh"));
    expect(res!.status).toBe(404);
  });
});

describe("GET /api/events", () => {
  test("returns SSE response headers", async () => {
    const res = await router(req("GET", "/api/events"));
    expect(res).not.toBeNull();
    expect(res!.headers.get("Content-Type")).toBe("text/event-stream");
    sse.close();
  });
});

describe("unknown routes", () => {
  test("returns null for unmatched route", async () => {
    const res = await router(req("GET", "/unknown"));
    expect(res).toBeNull();
  });
});
