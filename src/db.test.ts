import type { Database } from "bun:sqlite";
import { beforeEach, describe, expect, test } from "bun:test";
import {
  createBlock,
  deleteBlock,
  findDueBlocks,
  getBlock,
  initDb,
  listBlocks,
  markBlockError,
  markBlockRunning,
  markBlockSuccess,
  resetStaleRunningBlocks,
  updateBlock,
} from "./db.ts";

let db: Database;

beforeEach(() => {
  db = initDb();
});

describe("CRUD", () => {
  test("create and list blocks", () => {
    const b1 = createBlock(db, {
      prompt: "test 1",
      intervalValue: 5,
      intervalUnit: "minutes",
    });
    const b2 = createBlock(db, {
      prompt: "test 2",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    expect(b1.id).toBe(1);
    expect(b2.id).toBe(2);
    expect(b1.status).toBe("idle");
    expect(b1.prompt).toBe("test 1");

    const all = listBlocks(db);
    expect(all).toHaveLength(2);
    expect(all[0]!.id).toBe(1);
    expect(all[1]!.id).toBe(2);
  });

  test("get block by id", () => {
    const created = createBlock(db, {
      prompt: "x",
      intervalValue: 1,
      intervalUnit: "days",
    });
    const fetched = getBlock(db, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.prompt).toBe("x");
  });

  test("get block returns null for missing id", () => {
    expect(getBlock(db, 999)).toBeNull();
  });

  test("update block", () => {
    const b = createBlock(db, {
      prompt: "old",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const updated = updateBlock(db, b.id, {
      prompt: "new",
      intervalValue: 2,
      intervalUnit: "days",
    });
    expect(updated).not.toBeNull();
    expect(updated!.prompt).toBe("new");
    expect(updated!.interval_value).toBe(2);
    expect(updated!.interval_unit).toBe("days");
  });

  test("update returns null for missing id", () => {
    expect(
      updateBlock(db, 999, {
        prompt: "x",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    ).toBeNull();
  });

  test("delete block", () => {
    const b = createBlock(db, {
      prompt: "del",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(deleteBlock(db, b.id)).toBe(true);
    expect(getBlock(db, b.id)).toBeNull();
  });

  test("delete returns false for missing id", () => {
    expect(deleteBlock(db, 999)).toBe(false);
  });
});

describe("state transitions", () => {
  test("markBlockRunning", () => {
    const b = createBlock(db, {
      prompt: "r",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    markBlockRunning(db, b.id, "2024-01-15T10:00:00.000Z");
    const fetched = getBlock(db, b.id)!;
    expect(fetched.status).toBe("running");
    expect(fetched.error_text).toBeNull();
    expect(fetched.running_started_at).toBe("2024-01-15T10:00:00.000Z");
  });

  test("markBlockSuccess", () => {
    const b = createBlock(db, {
      prompt: "s",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    markBlockRunning(db, b.id, "2024-01-15T10:00:00.000Z");
    markBlockSuccess(
      db,
      b.id,
      "<p>ok</p>",
      "2024-01-15T10:01:00.000Z",
      "2024-01-15T11:01:00.000Z",
    );
    const fetched = getBlock(db, b.id)!;
    expect(fetched.status).toBe("success");
    expect(fetched.output_html).toBe("<p>ok</p>");
    expect(fetched.error_text).toBeNull();
    expect(fetched.running_started_at).toBeNull();
    expect(fetched.last_run_at).toBe("2024-01-15T10:01:00.000Z");
    expect(fetched.next_run_at).toBe("2024-01-15T11:01:00.000Z");
  });

  test("markBlockError", () => {
    const b = createBlock(db, {
      prompt: "e",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    markBlockRunning(db, b.id, "2024-01-15T10:00:00.000Z");
    markBlockError(
      db,
      b.id,
      "timeout",
      "2024-01-15T10:01:00.000Z",
      "2024-01-15T11:01:00.000Z",
    );
    const fetched = getBlock(db, b.id)!;
    expect(fetched.status).toBe("error");
    expect(fetched.error_text).toBe("timeout");
    expect(fetched.running_started_at).toBeNull();
  });
});

describe("findDueBlocks", () => {
  test("returns due non-running blocks", () => {
    const b1 = createBlock(db, {
      prompt: "a",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    // b1 has next_run_at = now (at creation), so it's due

    const due = findDueBlocks(db, "2099-01-01T00:00:00.000Z", 10);
    expect(due).toHaveLength(1);
    expect(due[0]!.id).toBe(b1.id);
  });

  test("excludes running blocks", () => {
    const b = createBlock(db, {
      prompt: "a",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    markBlockRunning(db, b.id, "2024-01-15T10:00:00.000Z");

    const due = findDueBlocks(db, "2099-01-01T00:00:00.000Z", 10);
    expect(due).toHaveLength(0);
  });

  test("respects limit", () => {
    createBlock(db, {
      prompt: "a",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    createBlock(db, {
      prompt: "b",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    createBlock(db, {
      prompt: "c",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    const due = findDueBlocks(db, "2099-01-01T00:00:00.000Z", 2);
    expect(due).toHaveLength(2);
  });
});

describe("resetStaleRunningBlocks", () => {
  test("resets running blocks to error with next_run_at=now", () => {
    const b = createBlock(db, {
      prompt: "stale",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    markBlockRunning(db, b.id, "2024-01-15T10:00:00.000Z");

    const now = "2024-01-15T12:00:00.000Z";
    const count = resetStaleRunningBlocks(db, now);
    expect(count).toBe(1);

    const fetched = getBlock(db, b.id)!;
    expect(fetched.status).toBe("error");
    expect(fetched.error_text).toContain("server stopped");
    expect(fetched.next_run_at).toBe(now);
    expect(fetched.running_started_at).toBeNull();
  });
});

describe("validation", () => {
  test("rejects empty prompt", () => {
    expect(() =>
      createBlock(db, {
        prompt: "   ",
        intervalValue: 1,
        intervalUnit: "hours",
      }),
    ).toThrow("Prompt is required");
  });

  test("rejects invalid unit", () => {
    expect(() =>
      createBlock(db, {
        prompt: "x",
        intervalValue: 1,
        intervalUnit: "weeks" as any,
      }),
    ).toThrow("Invalid interval unit");
  });

  test("rejects interval <= 0", () => {
    expect(() =>
      createBlock(db, {
        prompt: "x",
        intervalValue: 0,
        intervalUnit: "hours",
      }),
    ).toThrow("Interval value must be a positive integer");
  });

  test("rejects non-integer interval", () => {
    expect(() =>
      createBlock(db, {
        prompt: "x",
        intervalValue: 1.5,
        intervalUnit: "hours",
      }),
    ).toThrow("Interval value must be a positive integer");
  });
});
