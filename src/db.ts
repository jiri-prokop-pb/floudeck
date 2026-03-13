import { Database } from "bun:sqlite";
import type {
  BlockRecord,
  CreateBlockInput,
  UpdateBlockInput,
  IntervalUnit,
} from "./types.ts";
import { nowIso } from "./time.ts";

const VALID_UNITS: IntervalUnit[] = ["minutes", "hours", "days"];

export function initDb(path?: string): Database {
  const db = path ? new Database(path) : new Database(":memory:");
  db.run("PRAGMA journal_mode = WAL");
  db.run(`
    CREATE TABLE IF NOT EXISTS blocks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt TEXT NOT NULL,
      interval_value INTEGER NOT NULL,
      interval_unit TEXT NOT NULL CHECK(interval_unit IN ('minutes', 'hours', 'days')),
      status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'success', 'error')),
      output_html TEXT,
      error_text TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_run_at TEXT,
      next_run_at TEXT,
      running_started_at TEXT
    )
  `);
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_blocks_next_run_at ON blocks(next_run_at)",
  );
  return db;
}

export function listBlocks(db: Database): BlockRecord[] {
  return db
    .query("SELECT * FROM blocks ORDER BY created_at ASC")
    .all() as BlockRecord[];
}

export function getBlock(db: Database, id: number): BlockRecord | null {
  return (
    (db.query("SELECT * FROM blocks WHERE id = ?").get(id) as BlockRecord) ??
    null
  );
}

function validateBlockInput(input: { prompt: string; intervalValue: number; intervalUnit: string }) {
  const prompt = input.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");
  if (!Number.isInteger(input.intervalValue) || input.intervalValue <= 0)
    throw new Error("Interval value must be a positive integer");
  if (!VALID_UNITS.includes(input.intervalUnit as IntervalUnit))
    throw new Error("Invalid interval unit");
}

export function createBlock(
  db: Database,
  input: CreateBlockInput,
): BlockRecord {
  validateBlockInput(input);
  const now = nowIso();
  const result = db
    .query(
      `INSERT INTO blocks (prompt, interval_value, interval_unit, status, created_at, updated_at, next_run_at)
       VALUES (?, ?, ?, 'idle', ?, ?, ?)
       RETURNING *`,
    )
    .get(
      input.prompt.trim(),
      input.intervalValue,
      input.intervalUnit,
      now,
      now,
      now,
    ) as BlockRecord;
  return result;
}

export function updateBlock(
  db: Database,
  id: number,
  input: UpdateBlockInput,
): BlockRecord | null {
  validateBlockInput(input);
  const now = nowIso();
  const result = db
    .query(
      `UPDATE blocks SET prompt = ?, interval_value = ?, interval_unit = ?, updated_at = ?, next_run_at = ?
       WHERE id = ? RETURNING *`,
    )
    .get(
      input.prompt.trim(),
      input.intervalValue,
      input.intervalUnit,
      now,
      now,
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
    `UPDATE blocks SET status = 'running', error_text = NULL, running_started_at = ?, updated_at = ? WHERE id = ?`,
    startedAt,
    startedAt,
    id,
  );
}

export function markBlockSuccess(
  db: Database,
  id: number,
  outputHtml: string,
  finishedAt: string,
  nextRunAt: string,
): void {
  db.run(
    `UPDATE blocks SET status = 'success', output_html = ?, error_text = NULL,
     last_run_at = ?, next_run_at = ?, running_started_at = NULL, updated_at = ?
     WHERE id = ?`,
    outputHtml,
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
