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

async function jsonBody(res: Response | null) {
  expect(res).not.toBeNull();
  return res?.json();
}

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
    const data = await jsonBody(res);
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
    const data = await jsonBody(res);
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
    const created = await jsonBody(createRes);
    const res = await router(req("GET", `/api/blocks/${created.block.id}`));
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.block.prompt).toBe("find me");
  });

  test("returns 404 for missing id", async () => {
    const res = await router(req("GET", "/api/blocks/999"));
    expect(res?.status).toBe(404);
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
    expect(res?.status).toBe(201);
    const data = await jsonBody(res);
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
    expect(res?.status).toBe(400);
  });

  test("rejects missing prompt", async () => {
    const res = await router(
      req("POST", "/api/blocks", {
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    expect(res?.status).toBe(400);
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
    const { block } = await jsonBody(createRes);

    const res = await router(
      req("POST", `/api/blocks/${block.id}/update`, {
        prompt: "new",
        intervalValue: 2,
        intervalUnit: "days",
      }),
    );
    expect(res?.status).toBe(200);
    const data = await jsonBody(res);
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
    expect(res?.status).toBe(404);
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
    const { block } = await jsonBody(createRes);

    const res = await router(req("POST", `/api/blocks/${block.id}/delete`));
    expect(res?.status).toBe(200);
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);

    // Verify deleted
    const getRes = await router(req("GET", `/api/blocks/${block.id}`));
    expect(getRes?.status).toBe(404);
  });

  test("returns 404 for missing id", async () => {
    const res = await router(req("POST", "/api/blocks/999/delete"));
    expect(res?.status).toBe(404);
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
    const { block } = await jsonBody(createRes);
    triggeredIds = [];

    const res = await router(req("POST", `/api/blocks/${block.id}/refresh`));
    expect(res?.status).toBe(200);
    expect(triggeredIds).toContain(block.id);
  });

  test("returns 404 for missing id", async () => {
    const res = await router(req("POST", "/api/blocks/999/refresh"));
    expect(res?.status).toBe(404);
  });
});

describe("GET /api/events", () => {
  test("returns SSE response headers", async () => {
    const res = await router(req("GET", "/api/events"));
    expect(res).not.toBeNull();
    expect(res?.headers.get("Content-Type")).toBe("text/event-stream");
    sse.close();
  });
});

describe("GET /api/settings/runner", () => {
  test("returns null config when no settings set", async () => {
    const res = await router(req("GET", "/api/settings/runner"));
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.config).toBeNull();
  });

  test("returns saved config", async () => {
    await router(
      req("POST", "/api/settings/runner", {
        config: { model: "opus", timeout: 120 },
      }),
    );
    const res = await router(req("GET", "/api/settings/runner"));
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.config.model).toBe("opus");
    expect(data.config.timeout).toBe(120);
  });
});

describe("POST /api/settings/runner", () => {
  test("saves valid config", async () => {
    const res = await router(
      req("POST", "/api/settings/runner", {
        config: { model: "sonnet", permissions: "default" },
      }),
    );
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.config).toEqual({ model: "sonnet", permissions: "default" });
  });

  test("strips cwd from global settings", async () => {
    const res = await router(
      req("POST", "/api/settings/runner", {
        config: { model: "opus", cwd: "/should/be/stripped" },
      }),
    );
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.config).toEqual({ model: "opus" });
    // Verify it's not stored
    const getRes = await router(req("GET", "/api/settings/runner"));
    const getData = await getRes?.json();
    expect(getData.config.cwd).toBeUndefined();
  });

  test("clears config when null/empty", async () => {
    // First set something
    await router(
      req("POST", "/api/settings/runner", {
        config: { model: "opus" },
      }),
    );
    // Then clear it
    await router(req("POST", "/api/settings/runner", { config: null }));
    const res = await router(req("GET", "/api/settings/runner"));
    const data = await jsonBody(res);
    expect(data.config).toBeNull();
  });
});

describe("GET /api/blocks/:id enriched", () => {
  test("includes resolvedConfig and cliCommand", async () => {
    const createRes = await router(
      req("POST", "/api/blocks", {
        prompt: "test",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    const { block } = await jsonBody(createRes);
    const res = await router(req("GET", `/api/blocks/${block.id}`));
    const data = await jsonBody(res);
    expect(data.resolvedConfig).toBeDefined();
    expect(data.resolvedConfig.model).toBe("sonnet");
    expect(data.resolvedConfig.permissions).toBe("default");
    expect(data.cliCommand).toContain("claude");
    expect(data.cliCommand).toContain("--model");
  });
});

describe("POST /api/blocks with runnerConfig", () => {
  test("creates block with runner config", async () => {
    const res = await router(
      req("POST", "/api/blocks", {
        prompt: "test",
        intervalValue: 1,
        intervalUnit: "hours",
        runnerConfig: { model: "opus", cwd: "/my/project" },
      }),
    );
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    const parsed = JSON.parse(data.block.runner_config);
    expect(parsed).toEqual({ model: "opus", cwd: "/my/project" });
  });
});

describe("GET /api/settings/display", () => {
  test("returns null config when no settings set", async () => {
    const res = await router(req("GET", "/api/settings/display"));
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.config).toBeNull();
  });

  test("returns saved config", async () => {
    await router(
      req("POST", "/api/settings/display", {
        config: { dateFormat: "MM-DD", timeFormat: "12h" },
      }),
    );
    const res = await router(req("GET", "/api/settings/display"));
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.config.dateFormat).toBe("MM-DD");
    expect(data.config.timeFormat).toBe("12h");
  });
});

describe("POST /api/settings/display", () => {
  test("saves valid config", async () => {
    const res = await router(
      req("POST", "/api/settings/display", {
        config: { dateFormat: "DD/MM", timeFormat: "24h" },
      }),
    );
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);
    expect(data.config).toEqual({
      dateFormat: "DD/MM",
      timeFormat: "24h",
    });
  });

  test("clears config when null/empty", async () => {
    await router(
      req("POST", "/api/settings/display", {
        config: { dateFormat: "MM-DD" },
      }),
    );
    await router(req("POST", "/api/settings/display", { config: null }));
    const res = await router(req("GET", "/api/settings/display"));
    const data = await jsonBody(res);
    expect(data.config).toBeNull();
  });
});

describe("POST /api/blocks/reorder", () => {
  test("reorders blocks and returns ok", async () => {
    const r1 = await router(
      req("POST", "/api/blocks", {
        prompt: "a",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    const r2 = await router(
      req("POST", "/api/blocks", {
        prompt: "b",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    );
    const b1 = (await jsonBody(r1)).block;
    const b2 = (await jsonBody(r2)).block;

    const res = await router(
      req("POST", "/api/blocks/reorder", { orderedIds: [b2.id, b1.id] }),
    );
    const data = await jsonBody(res);
    expect(data.ok).toBe(true);

    // Verify order persisted
    const listRes = await router(req("GET", "/api/blocks"));
    const listData = await jsonBody(listRes);
    expect(listData.blocks[0].id).toBe(b2.id);
    expect(listData.blocks[1].id).toBe(b1.id);
  });

  test("returns 400 for invalid input", async () => {
    const res = await router(
      req("POST", "/api/blocks/reorder", { orderedIds: "not-array" }),
    );
    expect(res?.status).toBe(400);
  });

  test("returns 400 for empty array", async () => {
    const res = await router(
      req("POST", "/api/blocks/reorder", { orderedIds: [] }),
    );
    expect(res?.status).toBe(400);
  });
});

describe("unknown routes", () => {
  test("returns null for unmatched route", async () => {
    const res = await router(req("GET", "/unknown"));
    expect(res).toBeNull();
  });
});
