import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import {
  backupDatabase,
  checkDatabaseIntegrity,
  createBlock,
  deleteBlock,
  findBackups,
  findDueBlocks,
  getBlock,
  getSchemaVersion,
  getSetting,
  initDb,
  listBlocks,
  markBlockError,
  markBlockRunning,
  markBlockSuccess,
  parseBlockRunnerConfig,
  reorderBlocks,
  resetStaleRunningBlocks,
  setSchemaVersion,
  setSetting,
  updateBlock,
} from "./db.ts";

function mustGetBlock(db: Database, id: number) {
  const block = getBlock(db, id);
  if (!block) throw new Error(`Block ${id} not found`);
  return block;
}

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
    expect(all[0]?.id).toBe(1);
    expect(all[1]?.id).toBe(2);
  });

  test("get block by id", () => {
    const created = createBlock(db, {
      prompt: "x",
      intervalValue: 1,
      intervalUnit: "days",
    });
    const fetched = getBlock(db, created.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.prompt).toBe("x");
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
    expect(updated?.prompt).toBe("new");
    expect(updated?.interval_value).toBe(2);
    expect(updated?.interval_unit).toBe("days");
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

  test("createBlock with tryResult sets status, output, and future next_run_at", () => {
    const before = new Date().toISOString();
    const b = createBlock(db, {
      prompt: "try test",
      intervalValue: 1,
      intervalUnit: "hours",
      tryResult: "# Try Output\n\nHello.",
    });
    expect(b.status).toBe("success");
    expect(b.output_markdown).toBe("# Try Output\n\nHello.");
    // next_run_at should be ~1 hour in the future, not equal to created_at
    if (!b.next_run_at) throw new Error("next_run_at should be set");
    expect(b.next_run_at > before).toBe(true);
    expect(b.next_run_at > b.created_at).toBe(true);
  });

  test("updateBlock with tryResult sets output and future next_run_at", () => {
    const b = createBlock(db, {
      prompt: "original",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const updated = updateBlock(db, b.id, {
      prompt: "edited",
      intervalValue: 1,
      intervalUnit: "hours",
      tryResult: "# Edited Output\n\nDone.",
    });
    if (!updated) throw new Error("updateBlock returned null");
    expect(updated.status).toBe("success");
    expect(updated.output_markdown).toBe("# Edited Output\n\nDone.");
    if (!updated.next_run_at) throw new Error("next_run_at should be set");
    expect(updated.next_run_at > updated.updated_at).toBe(true);
  });

  test("updateBlock without tryResult sets next_run_at to now", () => {
    const b = createBlock(db, {
      prompt: "original",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const updated = updateBlock(db, b.id, {
      prompt: "edited",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    if (!updated) throw new Error("updateBlock returned null");
    expect(updated.next_run_at).toBe(updated.updated_at);
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
    const fetched = mustGetBlock(db, b.id);
    expect(fetched.status).toBe("running");
    expect(fetched.running_started_at).toBe("2024-01-15T10:00:00.000Z");
  });

  test("markBlockRunning preserves prior error_text", () => {
    const b = createBlock(db, {
      prompt: "e",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    markBlockRunning(db, b.id, "2024-01-15T10:00:00.000Z");
    markBlockError(
      db,
      b.id,
      "previous failure",
      "2024-01-15T10:01:00.000Z",
      "2024-01-15T11:01:00.000Z",
    );
    markBlockRunning(db, b.id, "2024-01-15T11:01:00.000Z");
    const fetched = mustGetBlock(db, b.id);
    expect(fetched.status).toBe("running");
    expect(fetched.error_text).toBe("previous failure");
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
    const fetched = mustGetBlock(db, b.id);
    expect(fetched.status).toBe("success");
    expect(fetched.output_markdown).toBe("<p>ok</p>");
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
    const fetched = mustGetBlock(db, b.id);
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
    expect(due[0]?.id).toBe(b1.id);
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

    const fetched = mustGetBlock(db, b.id);
    expect(fetched.status).toBe("error");
    expect(fetched.error_text).toContain("server stopped");
    expect(fetched.next_run_at).toBe(now);
    expect(fetched.running_started_at).toBeNull();
  });
});

describe("initDb", () => {
  test("creates parent directories for file-backed databases", async () => {
    const tempRoot = mkdtempSync(`${tmpdir()}/floudeck-db-`);
    const dbPath = `${tempRoot}/nested/data/floudeck.sqlite`;

    const fileDb = initDb(dbPath);

    expect(await Bun.file(dbPath).exists()).toBe(true);
    const table = fileDb
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'blocks'",
      )
      .get() as { name: string } | null;
    expect(table).toEqual({ name: "blocks" });

    fileDb.close();
    rmSync(tempRoot, { recursive: true, force: true });
  });

  test("creates settings table", () => {
    const table = db
      .query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'settings'",
      )
      .get() as { name: string } | null;
    expect(table).toEqual({ name: "settings" });
  });
});

describe("uuid and runner_config", () => {
  test("createBlock generates uuid", () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(b.uuid).toBeTruthy();
    expect(b.uuid.length).toBeGreaterThan(10);
  });

  test("each block gets a unique uuid", () => {
    const b1 = createBlock(db, {
      prompt: "a",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const b2 = createBlock(db, {
      prompt: "b",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(b1.uuid).not.toBe(b2.uuid);
  });

  test("createBlock stores runner_config as JSON", () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
      runnerConfig: { model: "opus", timeout: 120 },
    });
    expect(b.runner_config).toBe('{"model":"opus","timeout":120}');
  });

  test("createBlock with no runner_config stores null", () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(b.runner_config).toBeNull();
  });

  test("updateBlock stores runner_config", () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const updated = updateBlock(db, b.id, {
      prompt: "updated",
      intervalValue: 2,
      intervalUnit: "days",
      runnerConfig: { cwd: "/my/path" },
    });
    expect(updated).not.toBeNull();
    expect(updated?.runner_config).toBe('{"cwd":"/my/path"}');
  });

  test("parseBlockRunnerConfig parses valid JSON", () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
      runnerConfig: { model: "opus" },
    });
    const config = parseBlockRunnerConfig(b);
    expect(config).toEqual({ model: "opus" });
  });

  test("parseBlockRunnerConfig returns null for no config", () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(parseBlockRunnerConfig(b)).toBeNull();
  });

  test("parseBlockRunnerConfig returns null for invalid JSON", () => {
    const b = createBlock(db, {
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    db.run("UPDATE blocks SET runner_config = 'not json' WHERE id = ?", b.id);
    const fetched = mustGetBlock(db, b.id);
    expect(parseBlockRunnerConfig(fetched)).toBeNull();
  });
});

describe("position and reorder", () => {
  test("createBlock assigns incrementing positions", () => {
    const b1 = createBlock(db, {
      prompt: "a",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const b2 = createBlock(db, {
      prompt: "b",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const b3 = createBlock(db, {
      prompt: "c",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(b1.position).toBe(1000);
    expect(b2.position).toBe(2000);
    expect(b3.position).toBe(3000);
  });

  test("listBlocks orders by position", () => {
    createBlock(db, {
      prompt: "first",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const b2 = createBlock(db, {
      prompt: "second",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    // Manually set b2 to lower position
    db.run("UPDATE blocks SET position = 500 WHERE id = ?", b2.id);

    const all = listBlocks(db);
    expect(all[0].prompt).toBe("second");
    expect(all[1].prompt).toBe("first");
  });

  test("reorderBlocks reassigns sparse positions", () => {
    const b1 = createBlock(db, {
      prompt: "a",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const b2 = createBlock(db, {
      prompt: "b",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    const b3 = createBlock(db, {
      prompt: "c",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    // Reverse order
    reorderBlocks(db, [b3.id, b1.id, b2.id]);

    const all = listBlocks(db);
    expect(all[0].id).toBe(b3.id);
    expect(all[1].id).toBe(b1.id);
    expect(all[2].id).toBe(b2.id);

    // Positions should be sparse multiples of 1000
    expect(all[0].position).toBe(1000);
    expect(all[1].position).toBe(2000);
    expect(all[2].position).toBe(3000);
  });
});

describe("settings", () => {
  test("getSetting returns null for missing key", () => {
    expect(getSetting(db, "nonexistent")).toBeNull();
  });

  test("setSetting and getSetting roundtrip", () => {
    setSetting(db, "test_key", "test_value");
    expect(getSetting(db, "test_key")).toBe("test_value");
  });

  test("setSetting upserts on conflict", () => {
    setSetting(db, "key", "first");
    setSetting(db, "key", "second");
    expect(getSetting(db, "key")).toBe("second");
  });
});

describe("migration transactions", () => {
  test("successful migration advances version", () => {
    // Create a fresh :memory: DB at version 1
    const testDb = initDb();
    expect(getSchemaVersion(testDb)).toBe(1);

    // Simulate a migration that adds a column
    testDb.transaction(() => {
      testDb.run("ALTER TABLE blocks ADD COLUMN test_col TEXT");
      setSchemaVersion(testDb, 2);
    })();

    expect(getSchemaVersion(testDb)).toBe(2);
    // Verify column exists
    const info = testDb.query("PRAGMA table_info(blocks)").all() as Array<{
      name: string;
    }>;
    const colNames = info.map((c) => c.name);
    expect(colNames).toContain("test_col");
  });

  test("failing migration rolls back version and schema", () => {
    const testDb = initDb();
    expect(getSchemaVersion(testDb)).toBe(1);

    try {
      testDb.transaction(() => {
        testDb.run("ALTER TABLE blocks ADD COLUMN rollback_col TEXT");
        setSchemaVersion(testDb, 2);
        throw new Error("simulated failure");
      })();
    } catch {
      // expected
    }

    // Version should not have changed
    expect(getSchemaVersion(testDb)).toBe(1);
    // Column should not exist
    const info = testDb.query("PRAGMA table_info(blocks)").all() as Array<{
      name: string;
    }>;
    const colNames = info.map((c) => c.name);
    expect(colNames).not.toContain("rollback_col");
  });
});

describe("backupDatabase", () => {
  let tempRoot: string;

  afterEach(() => {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  });

  test("creates backup for file-backed DB", () => {
    tempRoot = mkdtempSync(`${tmpdir()}/floudeck-backup-`);
    const dbPath = `${tempRoot}/floudeck.sqlite`;
    const fileDb = initDb(dbPath);
    createBlock(fileDb, {
      prompt: "backup test",
      intervalValue: 1,
      intervalUnit: "hours",
    });

    const backupPath = backupDatabase(fileDb, dbPath, 1);
    expect(backupPath).not.toBeNull();
    if (!backupPath) throw new Error("backupPath should not be null");
    expect(existsSync(backupPath)).toBe(true);

    // Verify backup is a valid SQLite DB
    fileDb.close();
    const backupDb = new Database(backupPath);
    const blocks = backupDb.query("SELECT * FROM blocks").all();
    expect(blocks).toHaveLength(1);
    backupDb.close();
  });

  test("returns null for :memory: DB", () => {
    const memDb = initDb();
    expect(backupDatabase(memDb, ":memory:", 1)).toBeNull();
  });
});

describe("checkDatabaseIntegrity", () => {
  test("returns true for healthy DB", () => {
    expect(checkDatabaseIntegrity(db)).toBe(true);
  });
});

describe("findBackups", () => {
  let tempRoot: string;

  afterEach(() => {
    if (tempRoot) rmSync(tempRoot, { recursive: true, force: true });
  });

  test("finds and sorts backup files", () => {
    tempRoot = mkdtempSync(`${tmpdir()}/floudeck-find-`);
    const dbPath = `${tempRoot}/floudeck.sqlite`;

    // Create fake backup files
    writeFileSync(`${tempRoot}/floudeck.sqlite.backup-v1`, "fake");
    writeFileSync(`${tempRoot}/floudeck.sqlite.backup-v3`, "fake");
    writeFileSync(`${tempRoot}/floudeck.sqlite.backup-v2`, "fake");
    writeFileSync(`${tempRoot}/unrelated-file.txt`, "nope");

    const backups = findBackups(dbPath);
    expect(backups).toHaveLength(3);
    // Sorted descending by version
    expect(backups[0].version).toBe(3);
    expect(backups[1].version).toBe(2);
    expect(backups[2].version).toBe(1);
  });

  test("returns empty for :memory:", () => {
    expect(findBackups(":memory:")).toEqual([]);
  });

  test("finds backup files with suffix", () => {
    tempRoot = mkdtempSync(`${tmpdir()}/floudeck-suffix-`);
    const dbPath = `${tempRoot}/floudeck.sqlite`;

    writeFileSync(`${tempRoot}/floudeck.sqlite.backup-v1`, "fake");
    writeFileSync(`${tempRoot}/floudeck.sqlite.backup-v1-pre-restore`, "fake");

    const backups = findBackups(dbPath);
    expect(backups).toHaveLength(2);
    // Both have version 1
    expect(backups[0].version).toBe(1);
    expect(backups[1].version).toBe(1);
  });
});
