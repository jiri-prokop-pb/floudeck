import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import { createBlock, getBlock, initDb, markBlockRunning } from "./db.ts";
import { createMockRunner } from "./runner.ts";
import { createScheduler, type Scheduler } from "./scheduler.ts";
import { createSseBroadcaster, type SseBroadcaster } from "./sse.ts";
import type { RunBlockFn, RunResult } from "./types.ts";

let db: Database;
let sse: SseBroadcaster;
let broadcasts: Array<{ event: string; data: unknown }>;

beforeEach(() => {
  db = initDb();
  broadcasts = [];
  sse = createSseBroadcaster();
  // Intercept broadcasts
  const origBroadcast = sse.broadcast.bind(sse);
  sse.broadcast = (event: string, data: unknown) => {
    broadcasts.push({ event, data });
    origBroadcast(event, data);
  };
});

function successRunner(): RunBlockFn {
  return createMockRunner(() => ({
    ok: true,
    html: "<p>done</p>",
    rawHtml: "<p>done</p>",
    reasoning: null,
  }));
}

function errorRunner(): RunBlockFn {
  return createMockRunner(() => ({
    ok: false,
    error: "mock error",
  }));
}

function delayRunner(ms: number): RunBlockFn {
  return createMockRunner(
    () =>
      new Promise<RunResult>((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              html: "<p>delayed</p>",
              rawHtml: "<p>delayed</p>",
              reasoning: null,
            }),
          ms,
        ),
      ),
  );
}

describe("scheduler", () => {
  test("due block runs on tick", async () => {
    createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const scheduler = createScheduler({
      db,
      sse,
      runBlock: successRunner(),
    });

    await scheduler.tick();

    const block = getBlock(db, 1)!;
    expect(block.status).toBe("success");
    expect(block.output_html).toBe("<p>done</p>");
    expect(block.next_run_at).not.toBeNull();
  });

  test("future block not run", async () => {
    const b = createBlock(db, {
      prompt: "future",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    // Set next_run_at to far future
    db.run(
      "UPDATE blocks SET next_run_at = '2099-01-01T00:00:00.000Z' WHERE id = ?",
      b.id,
    );

    const scheduler = createScheduler({
      db,
      sse,
      runBlock: successRunner(),
    });
    await scheduler.tick();

    const block = getBlock(db, b.id)!;
    expect(block.status).toBe("idle");
  });

  test("running block not re-triggered", async () => {
    const b = createBlock(db, {
      prompt: "running",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    markBlockRunning(db, b.id, new Date().toISOString());

    let runCount = 0;
    const scheduler = createScheduler({
      db,
      sse,
      runBlock: createMockRunner(() => {
        runCount++;
        return {
          ok: true,
          html: "<p>x</p>",
          rawHtml: "<p>x</p>",
          reasoning: null,
        };
      }),
    });
    await scheduler.tick();

    expect(runCount).toBe(0);
  });

  test("concurrency cap respected", async () => {
    createBlock(db, { prompt: "a", intervalValue: 1, intervalUnit: "hours" });
    createBlock(db, { prompt: "b", intervalValue: 1, intervalUnit: "hours" });
    createBlock(db, { prompt: "c", intervalValue: 1, intervalUnit: "hours" });

    let concurrentMax = 0;
    let concurrent = 0;

    const scheduler = createScheduler({
      db,
      sse,
      runBlock: createMockRunner(async () => {
        concurrent++;
        concurrentMax = Math.max(concurrentMax, concurrent);
        await new Promise((r) => setTimeout(r, 50));
        concurrent--;
        return {
          ok: true,
          html: "<p>x</p>",
          rawHtml: "<p>x</p>",
          reasoning: null,
        };
      }),
      maxConcurrency: 2,
    });

    await scheduler.tick();
    expect(concurrentMax).toBeLessThanOrEqual(2);
  });

  test("next_run_at set after success", async () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 30,
      intervalUnit: "minutes",
    });

    const scheduler = createScheduler({
      db,
      sse,
      runBlock: successRunner(),
    });
    await scheduler.tick();

    const block = getBlock(db, b.id)!;
    expect(block.status).toBe("success");
    expect(block.next_run_at).not.toBeNull();
    expect(block.last_run_at).not.toBeNull();
  });

  test("next_run_at set after error", async () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    const scheduler = createScheduler({
      db,
      sse,
      runBlock: errorRunner(),
    });
    await scheduler.tick();

    const block = getBlock(db, b.id)!;
    expect(block.status).toBe("error");
    expect(block.next_run_at).not.toBeNull();
  });

  test("SSE broadcasts on state transitions", async () => {
    createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    const scheduler = createScheduler({
      db,
      sse,
      runBlock: successRunner(),
    });
    await scheduler.tick();

    const events = broadcasts.map((b) => (b.data as { status: string }).status);
    expect(events).toContain("running");
    expect(events).toContain("success");
  });

  test("runner exception marks block error and scheduler continues", async () => {
    const b = createBlock(db, {
      prompt: "crash",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    const scheduler = createScheduler({
      db,
      sse,
      runBlock: createMockRunner(() => {
        throw new Error("boom");
      }),
    });
    await scheduler.tick();

    const block = getBlock(db, b.id)!;
    expect(block.status).toBe("error");
    expect(block.error_text).toBe("boom");
  });

  test("deleted block mid-run does not crash", async () => {
    const b = createBlock(db, {
      prompt: "will be deleted",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    const scheduler = createScheduler({
      db,
      sse,
      runBlock: createMockRunner(async () => {
        // Delete the block while "running"
        db.run("DELETE FROM blocks WHERE id = ?", b.id);
        return {
          ok: true,
          html: "<p>x</p>",
          rawHtml: "<p>x</p>",
          reasoning: null,
        };
      }),
    });

    // Should not throw
    await scheduler.tick();
    expect(getBlock(db, b.id)).toBeNull();
  });
});
