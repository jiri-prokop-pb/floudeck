# DB Migrations

## How to add a migration

1. Append to `MIGRATIONS[]` in `src/db.ts` with the next sequential version number:

```ts
const MIGRATIONS: Migration[] = [
  {
    version: 2,
    up: (db) => {
      db.run("ALTER TABLE blocks ADD COLUMN my_col TEXT");
    },
  },
];
```

2. Each migration runs inside a transaction — if `up()` throws, both the schema change and version bump roll back together.
3. Before running pending migrations on file-backed DBs, the framework auto-creates a backup at `{dbPath}.backup-v{currentVersion}`.

## Safe operations

- `ALTER TABLE ADD COLUMN` with `NULL` default or explicit `DEFAULT`
- `CREATE TABLE IF NOT EXISTS`
- `CREATE INDEX IF NOT EXISTS`
- Data backfill (`UPDATE ... SET new_col = ...`)

## Unsafe operations (avoid or handle carefully)

- `DROP COLUMN` — SQLite doesn't support it before 3.35; use table rebuild instead
- `RENAME COLUMN` — risky if code references old name during rollout
- Type changes — SQLite is dynamically typed but changing affinity can surprise queries
- Dropping data tables — data loss, no rollback

## Testing pattern

```ts
test("migration v2 adds my_col", () => {
  const testDb = initDb(); // starts at version 1
  // Insert test data before migration
  createBlock(testDb, { prompt: "test", intervalValue: 1, intervalUnit: "hours" });

  // Run migration manually
  testDb.transaction(() => {
    testDb.run("ALTER TABLE blocks ADD COLUMN my_col TEXT");
    setSchemaVersion(testDb, 2);
  })();

  expect(getSchemaVersion(testDb)).toBe(2);
  const info = testDb.query("PRAGMA table_info(blocks)").all() as Array<{ name: string }>;
  expect(info.map(c => c.name)).toContain("my_col");
});
```

## Backup and recovery

- **Auto-backup**: Created before every migration run on file-backed DBs
- **Manual recovery**: `GET /api/settings/db-status` shows health + available backups
- **Reset**: `POST /api/settings/reset-database` with `{ confirm: true }` — backs up, deletes DB, restarts
- **Restore**: `POST /api/settings/restore-database` with `{ confirm: true, version: N }` — restores from backup, restarts
- **UI**: `DatabaseErrorBanner` component shows automatically when integrity check fails

## Common patterns

### Add nullable column

```ts
{ version: 2, up: (db) => { db.run("ALTER TABLE blocks ADD COLUMN notes TEXT"); } }
```

### Add column with default

```ts
{ version: 3, up: (db) => { db.run("ALTER TABLE blocks ADD COLUMN priority INTEGER NOT NULL DEFAULT 0"); } }
```

### Add new table

```ts
{
  version: 4,
  up: (db) => {
    db.run(`CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      block_id INTEGER NOT NULL,
      name TEXT NOT NULL
    )`);
    db.run("CREATE INDEX IF NOT EXISTS idx_tags_block_id ON tags(block_id)");
  },
}
```

### Add index

```ts
{ version: 5, up: (db) => { db.run("CREATE INDEX IF NOT EXISTS idx_blocks_status ON blocks(status)"); } }
```
