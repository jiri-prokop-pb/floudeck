import { Database } from "bun:sqlite";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { getBackupPath } from "./paths.ts";
import { addInterval, nowIso } from "./time.ts";
import type {
  ActionRun,
  BlockRecord,
  CreateBlockInput,
  RunnerConfig,
  UpdateBlockInput,
} from "./types.ts";
import { safeParseRunnerConfig } from "./validate.ts";

export function getSchemaVersion(db: Database): number {
  const row = db.query("PRAGMA user_version").get();
  if (
    row &&
    typeof row === "object" &&
    "user_version" in row &&
    typeof row.user_version === "number"
  ) {
    return row.user_version;
  }
  return 0;
}

export function setSchemaVersion(db: Database, version: number): void {
  db.run(`PRAGMA user_version = ${version}`);
}

type Migration = {
  version: number;
  up: (db: Database) => void;
};

// Add new migrations here. Each must have a sequential version number.
const MIGRATIONS: Migration[] = [
  // version 1 = initial schema (created by initDb below)
];

export function backupDatabase(
  db: Database,
  dbPath: string,
  version: number,
  suffix?: string,
): string | null {
  if (dbPath === ":memory:" || !existsSync(dbPath)) return null;
  db.run("PRAGMA wal_checkpoint(TRUNCATE)");
  const dest = getBackupPath(version, suffix);
  copyFileSync(dbPath, dest);
  return dest;
}

export function checkDatabaseIntegrity(db: Database): boolean {
  const row = db.query("PRAGMA quick_check(1)").get();
  if (
    row &&
    typeof row === "object" &&
    "quick_check" in row &&
    row.quick_check === "ok"
  ) {
    return true;
  }
  return false;
}

export function findBackups(
  dbPath: string,
): Array<{ path: string; version: number }> {
  if (dbPath === ":memory:") return [];
  const dir = dbPath.substring(0, dbPath.lastIndexOf("/"));
  if (!dir || !existsSync(dir)) return [];

  const prefix = "floudeck.sqlite.backup-v";
  const entries = readdirSync(dir);
  const backups: Array<{ path: string; version: number }> = [];

  for (const entry of entries) {
    if (!entry.startsWith(prefix)) continue;
    const rest = entry.slice(prefix.length);
    // Extract version number (stops at first non-digit, e.g. "-pre-restore")
    const match = /^(\d+)/.exec(rest);
    if (!match) continue;
    const version = Number.parseInt(match[1], 10);
    if (Number.isNaN(version)) continue;
    backups.push({ path: `${dir}/${entry}`, version });
  }

  return backups.sort((a, b) => b.version - a.version);
}

function runMigrations(db: Database, dbPath?: string): void {
  const currentVersion = getSchemaVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > currentVersion);
  if (pending.length === 0) return;

  // Auto-backup before running migrations on file-backed DBs
  if (dbPath && dbPath !== ":memory:") {
    const backupPath = backupDatabase(db, dbPath, currentVersion);
    if (backupPath) {
      console.log(`db:backup created before migration: ${backupPath}`);
    }
  }

  for (const migration of pending) {
    db.transaction(() => {
      migration.up(db);
      setSchemaVersion(db, migration.version);
    })();
  }
}

export function initDb(path?: string): Database {
  if (path && path !== ":memory:") {
    const parentDir = path.substring(0, path.lastIndexOf("/"));
    if (parentDir) {
      mkdirSync(parentDir, { recursive: true });
    }
  }

  const db = path ? new Database(path) : new Database(":memory:");
  db.run("PRAGMA journal_mode = WAL");
  db.run(`
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT NOT NULL,
      prompt TEXT NOT NULL,
      interval_value INTEGER NOT NULL,
      interval_unit TEXT NOT NULL CHECK(interval_unit IN ('minutes', 'hours', 'days')),
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'success', 'error')),
      output_markdown TEXT,
      error_text TEXT,
      runner_config TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_run_at TEXT,
      next_run_at TEXT,
      running_started_at TEXT,
      position INTEGER NOT NULL DEFAULT 0
    )
  `);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_blocks_next_run_at ON blocks(next_run_at)",
  );
  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS action_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      click_id TEXT NOT NULL UNIQUE,
      block_id INTEGER NOT NULL,
      action_name TEXT NOT NULL,
      params TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'error')),
      output_markdown TEXT,
      error_text TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )
  `);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_action_runs_click_id ON action_runs(click_id)",
  );

  // Set initial schema version if this is a fresh DB
  if (getSchemaVersion(db) === 0) {
    setSchemaVersion(db, 1);
  }

  // Run any pending migrations
  runMigrations(db, path);

  return db;
}

export function listBlocks(db: Database): BlockRecord[] {
  return db
    .query("SELECT * FROM blocks ORDER BY position ASC, created_at ASC")
    .all() as BlockRecord[];
}

export function getBlock(db: Database, id: number): BlockRecord | null {
  return (
    (db.query("SELECT * FROM blocks WHERE id = ?").get(id) as BlockRecord) ??
    null
  );
}

export function createBlock(
  db: Database,
  input: CreateBlockInput,
): BlockRecord {
  const now = nowIso();
  const uuid = crypto.randomUUID();
  const runnerConfigJson = input.runnerConfig
    ? JSON.stringify(input.runnerConfig)
    : null;
  const hasTryResult = !!input.tryResult;
  const nextRunAt = hasTryResult
    ? addInterval(now, input.intervalValue, input.intervalUnit)
    : now;
  const result = db
    .query(
      `INSERT INTO blocks (uuid, prompt, interval_value, interval_unit, status, output_markdown, runner_config, created_at, updated_at, next_run_at, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(position), 0) + 1000 FROM blocks))
       RETURNING *`,
    )
    .get(
      uuid,
      input.prompt.trim(),
      input.intervalValue,
      input.intervalUnit,
      hasTryResult ? "success" : "idle",
      input.tryResult ?? null,
      runnerConfigJson,
      now,
      now,
      nextRunAt,
    ) as BlockRecord;
  return result;
}

export function updateBlock(
  db: Database,
  id: number,
  input: UpdateBlockInput,
): BlockRecord | null {
  const now = nowIso();
  const runnerConfigJson = input.runnerConfig
    ? JSON.stringify(input.runnerConfig)
    : null;
  const hasTryResult = !!input.tryResult;
  const nextRunAt = hasTryResult
    ? addInterval(now, input.intervalValue, input.intervalUnit)
    : now;
  const outputMarkdown = hasTryResult ? input.tryResult : undefined;
  const status = hasTryResult ? "success" : undefined;
  const result = db
    .query(
      `UPDATE blocks SET prompt = ?, interval_value = ?, interval_unit = ?, runner_config = ?,
       updated_at = ?, next_run_at = ?
       ${hasTryResult ? ", output_markdown = ?, status = ?" : ""}
       WHERE id = ? RETURNING *`,
    )
    .get(
      input.prompt.trim(),
      input.intervalValue,
      input.intervalUnit,
      runnerConfigJson,
      now,
      nextRunAt,
      ...(hasTryResult ? [outputMarkdown, status] : []),
      id,
    ) as BlockRecord | null;
  return result ?? null;
}

export function deleteBlock(db: Database, id: number): boolean {
  const result = db.run("DELETE FROM blocks WHERE id = ?", id);
  return result.changes > 0;
}

export function markBlockRunning(
  db: Database,
  id: number,
  startedAt: string,
): void {
  db.run(
    `UPDATE blocks SET status = 'running', running_started_at = ?, updated_at = ? WHERE id = ?`,
    startedAt,
    startedAt,
    id,
  );
}

export function markBlockSuccess(
  db: Database,
  id: number,
  outputMarkdown: string,
  finishedAt: string,
  nextRunAt: string,
): void {
  db.run(
    `UPDATE blocks SET status = 'success', output_markdown = ?, error_text = NULL,
     last_run_at = ?, next_run_at = ?, running_started_at = NULL, updated_at = ?
     WHERE id = ?`,
    outputMarkdown,
    finishedAt,
    nextRunAt,
    finishedAt,
    id,
  );
}

export function markBlockError(
  db: Database,
  id: number,
  errorText: string,
  finishedAt: string,
  nextRunAt: string,
): void {
  db.run(
    `UPDATE blocks SET status = 'error', error_text = ?,
     last_run_at = ?, next_run_at = ?, running_started_at = NULL, updated_at = ?
     WHERE id = ?`,
    errorText,
    finishedAt,
    nextRunAt,
    finishedAt,
    id,
  );
}

export function markBlockPendingImmediateRun(
  db: Database,
  id: number,
  updatedAt: string,
): void {
  db.run(
    `UPDATE blocks SET status = 'idle', next_run_at = ?, running_started_at = NULL, updated_at = ?
     WHERE id = ?`,
    updatedAt,
    updatedAt,
    id,
  );
}

export function findDueBlocks(
  db: Database,
  now: string,
  limit: number,
): BlockRecord[] {
  return db
    .query(
      `SELECT * FROM blocks
       WHERE next_run_at <= ? AND status != 'running'
       ORDER BY next_run_at ASC
       LIMIT ?`,
    )
    .all(now, limit) as BlockRecord[];
}

export function resetStaleRunningBlocks(db: Database, now: string): number {
  const result = db.run(
    `UPDATE blocks SET status = 'error',
     error_text = 'Previous run did not finish because the server stopped.',
     running_started_at = NULL, next_run_at = ?, updated_at = ?
     WHERE status = 'running'`,
    now,
    now,
  );
  return result.changes;
}

export function getSetting(db: Database, key: string): string | null {
  const row = db.query("SELECT value FROM settings WHERE key = ?").get(key) as {
    value: string;
  } | null;
  return row?.value ?? null;
}

export function setSetting(db: Database, key: string, value: string): void {
  db.run(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?",
    key,
    value,
    value,
  );
}

export function reorderBlocks(db: Database, orderedIds: number[]): void {
  const stmt = db.prepare("UPDATE blocks SET position = ? WHERE id = ?");
  db.transaction(() => {
    for (let i = 0; i < orderedIds.length; i++) {
      stmt.run((i + 1) * 1000, orderedIds[i]);
    }
  })();
}

export function parseBlockRunnerConfig(
  block: BlockRecord,
): RunnerConfig | null {
  return safeParseRunnerConfig(block.runner_config) ?? null;
}

// --- Action Runs ---

export function getActionRun(db: Database, clickId: string): ActionRun | null {
  return (
    (db
      .query("SELECT * FROM action_runs WHERE click_id = ?")
      .get(clickId) as ActionRun) ?? null
  );
}

export function createActionRun(
  db: Database,
  clickId: string,
  blockId: number,
  actionName: string,
  params: string | null,
  createdAt: string,
): ActionRun {
  return db
    .query(
      `INSERT INTO action_runs (click_id, block_id, action_name, params, status, created_at)
       VALUES (?, ?, ?, ?, 'running', ?)
       RETURNING *`,
    )
    .get(clickId, blockId, actionName, params, createdAt) as ActionRun;
}

export function markActionCompleted(
  db: Database,
  clickId: string,
  outputMarkdown: string,
  completedAt: string,
): void {
  db.run(
    `UPDATE action_runs SET status = 'completed', output_markdown = ?, completed_at = ? WHERE click_id = ?`,
    outputMarkdown,
    completedAt,
    clickId,
  );
}

export function markActionError(
  db: Database,
  clickId: string,
  errorText: string,
  completedAt: string,
): void {
  db.run(
    `UPDATE action_runs SET status = 'error', error_text = ?, completed_at = ? WHERE click_id = ?`,
    errorText,
    completedAt,
    clickId,
  );
}

export function cleanupExpiredActionRuns(
  db: Database,
  olderThan: string,
): number {
  const result = db.run(
    "DELETE FROM action_runs WHERE created_at < ?",
    olderThan,
  );
  return result.changes;
}

export function getBlockByUuid(db: Database, uuid: string): BlockRecord | null {
  return (
    (db
      .query("SELECT * FROM blocks WHERE uuid = ?")
      .get(uuid) as BlockRecord) ?? null
  );
}
