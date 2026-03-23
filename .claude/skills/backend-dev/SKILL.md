---
name: backend-dev
description: Backend development conventions — zod/mini validation, runner config resolution, block UUIDs, action cleanup
---

# Backend development conventions

## JSON parsing — zod/mini

All `JSON.parse` of structured data uses `zod/mini` schema with `safeParse`. Never cast parsed JSON with `as`.

- **Schemas** live in `src/types.ts` alongside `z.infer<typeof Schema>` types: `RunnerConfigSchema`, `DisplaySettingsSchema`, `ActionRunSchema`, `BlockInputSchema`
- **Parsing** is centralized in `src/validate.ts`:
  - `safeParseRunnerConfig(raw: string | null)` — for DB JSON strings: wraps `JSON.parse` in try/catch, then `safeParse`, returns `undefined` on failure
  - `parseRunnerConfig(raw: unknown, options?)` — for API request bodies: uses `LenientRunnerConfigSchema` (env values typed as `z.unknown()`) for graceful filtering
  - `safeParseDisplaySettings` follows the same pattern
  - `BlockInputSchema.safeParse` for block creation, mapping `result.error.issues[0].path` to typed `BlockInputError` objects

## Runner config resolution

Three-level merge in `src/config.ts`: hardcoded defaults < global (from `settings` table) < per-block (`blocks.runner_config` column).

`resolveRunnerConfig(globalDefaults, blockConfig, blockUuid)`:
- **cwd** is block-only: uses `block.cwd` if set, otherwise auto-generates `~/.floudeck/blocks-workspace/{blockUuid}`. Global `cwd` is intentionally skipped.
- **model, permissions, timeout**: `block || global || hardcoded_default` precedence
- **env**: three-way spread merge (`defaults.env`, `global.env`, `block.env`), then `$__FLOUDECK_INHERIT__` sentinel values are replaced by `Bun.env[key]` at runtime; missing keys silently omitted
- `ensureCwd()` calls `mkdirSync(..., { recursive: true })`

`buildCliArgs` translates resolved config to CLI flags: `--dangerously-skip-permissions`, `--model`, `--append-system-prompt`.

The scheduler loads global config per tick via `safeParseRunnerConfig(getSetting(db, "runner_defaults"))`. Block config via `parseBlockRunnerConfig(block)` in `db.ts`.

## Block UUIDs

Generated in `createBlock()` via `crypto.randomUUID()`, stored in `uuid TEXT NOT NULL` column.

Uses:
- **Workspace directory**: `~/.floudeck/blocks-workspace/{blockUuid}` as default `cwd`
- **Prompt context**: scheduler appends `[Block UUID: {uuid}]` to every prompt before execution
- **API lookup**: `getBlockByUuid(db, uuid)` for action routes

## Action cleanup

No separate timer — cleanup piggybacks on the scheduler tick with an in-memory timestamp gate.

`maybeCleanupActions()` runs at the top of every `tick()` (every 10s):
- Checks `now - lastCleanup < CLEANUP_INTERVAL_MS` (1 hour) — skips if too soon
- Computes 24h cutoff: `new Date(now - 24 * 60 * 60 * 1000).toISOString()`
- Calls `cleanupExpiredActionRuns(db, cutoff)` → `DELETE FROM action_runs WHERE created_at < ?`
- Logs count if non-zero
