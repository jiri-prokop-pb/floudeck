# Floudeck Implementation Plan

## Context

Floudeck is a greenfield PoC: a single Bun app that schedules prompts through Claude Code CLI and renders sanitized HTML in a feed. SPEC.md and PLAN.md are complete; no source code exists yet. The goal is to implement the full PoC in incremental, testable phases where each phase is verified before proceeding. The runner (Claude CLI) must be mockable so tests never spend real API credits.

---

## Testability Architecture

Every module uses **dependency injection via factory functions** — no module-level singletons, no monkey-patching.

| Module | Injection point | Test strategy |
|--------|----------------|---------------|
| `db.ts` | All functions take `Database` param | `:memory:` SQLite per test |
| `runner.ts` | `RunBlockFn` type; `createCliRunner()` / `createMockRunner()` factories | Tests use mock runner or test `processCliOutput()` pure function directly |
| `scheduler.ts` | `createScheduler(deps)` returns `{ start, stop, tick }` | Tests call `tick()` directly, no timers |
| `api.ts` | `createRouter(deps)` takes db, sse, triggerRun | In-memory db + real SSE broadcaster |
| `server.ts` | `createApp(deps)` factory; auto-starts only via `import.meta.main` | Tests create isolated instances on port 0 |
| `sse.ts` | `createSseBroadcaster()` factory | Unit test broadcast/client management |

---

## Phase 0: Project Bootstrap

**Files:** `package.json`, `tsconfig.json`, `bunfig.toml`, `biome.json`, `src/types.ts` (placeholder)

1. `bun init`, install deps:
   ```bash
   bun add react react-dom sanitize-html
   bun add -d bun-plugin-tailwind typescript @types/react @types/react-dom @types/sanitize-html
   ```
2. `tsconfig.json` — strict, jsx: "react-jsx"
3. `bunfig.toml` — tailwind plugin for `serve.static`
4. `biome.json` — formatter (2-space indent, double quotes) + linter
5. `package.json` scripts: `"dev"`, `"test"`, `"lint"`, `"format"`, `"check"`

**Verify:** `bun test` exits 0, `bun run lint` exits 0

---

## Phase 1: Core Utilities & Types

**Files:** `src/types.ts`, `src/time.ts`, `src/sanitize.ts`, `src/prompts.ts` + tests for each

### `types.ts`
- `IntervalUnit`, `BlockStatus`, `BlockRecord`, `RunResult`, `RunBlockFn`
- `CreateBlockInput`, `UpdateBlockInput`

### `time.ts`
- `nowIso()`, `addInterval(base, value, unit)`, `isDue(nextRunAt, now)`

### `sanitize.ts`
- `SANITIZE_OPTIONS` config (allow-list from SPEC)
- `sanitizeBlockHtml(raw): string`
- `extractHtmlFromOutput(stdout): { html: string | null; reasoning: string | null }`

### `prompts.ts`
- `SYSTEM_PROMPT` constant, `ALLOWED_TAGS`, `ALLOWED_ATTRIBUTES` (shared with sanitize.ts)

### Tests
- `time.test.ts`: addInterval math, isDue logic, null handling
- `sanitize.test.ts`: allowed tags pass, script/iframe/form/style stripped, delimiter extraction, empty-after-sanitize
- `prompts.test.ts`: SYSTEM_PROMPT contains required delimiters and all allowed tags

**Verify:** `bun test src/*.test.ts && bun run lint`

---

## Phase 2: Database Layer

**Files:** `src/db.ts`, `src/db.test.ts`

All functions take `Database` param. Schema created in `initDb(path?)`.

Functions: `initDb`, `listBlocks`, `getBlock`, `createBlock`, `updateBlock`, `deleteBlock`, `markBlockRunning`, `markBlockSuccess`, `markBlockError`, `findDueBlocks`, `resetStaleRunningBlocks`

### Tests (all use `:memory:`)
- CRUD: create, list (creation order), get, update, delete
- State transitions: markRunning, markSuccess, markError
- `findDueBlocks`: returns due + non-running blocks, respects limit, excludes running
- `resetStaleRunningBlocks`: converts running → error with next_run_at=now
- Validation: empty prompt, invalid unit, interval ≤ 0

**Verify:** `bun test src/db.test.ts`

---

## Phase 3: SSE Module

**Files:** `src/sse.ts`, `src/sse.test.ts`

`createSseBroadcaster()` returns `{ addClient, removeClient, broadcast, clientCount, close }`.

### Tests
- addClient returns Response with SSE headers
- broadcast sends correctly formatted SSE frames (event + data + blank line)
- Dead clients removed on broadcast failure
- close cleans up all clients

**Verify:** `bun test src/sse.test.ts`

---

## Phase 4: Runner Module

**Files:** `src/runner.ts`, `src/runner.test.ts`

Exports:
- `RunBlockFn` type (re-export from types)
- `createCliRunner(options?)` — real CLI runner
- `createMockRunner(handler)` — for tests
- `processCliOutput(stdout, stderr, exitCode): RunResult` — pure function for testing the parse+sanitize pipeline

### Tests (no CLI calls)
- `processCliOutput`: valid output → extracts + sanitizes HTML
- Missing delimiters → error
- Empty HTML section → error
- All-unsafe HTML → sanitized to empty → error
- Non-zero exit code → error with stderr message
- `createMockRunner` returns predictable results

**Verify:** `bun test src/runner.test.ts`

---

## Phase 5: API Layer

**Files:** `src/api.ts`, `src/api.test.ts`

`createRouter({ db, sse, triggerRun })` returns `(req: Request) => Promise<Response | null>`.

Routes: GET /api/blocks, GET /api/blocks/:id, GET /api/events, POST /api/blocks, POST /api/blocks/:id/refresh, POST /api/blocks/:id/update, POST /api/blocks/:id/delete

### Tests (in-memory db, real SSE broadcaster)
- GET blocks: empty list, populated list
- GET block by id: found, 404
- POST create: valid input, invalid input (400)
- POST update: valid, 404
- POST delete: valid, 404
- POST refresh: sets next_run_at=now, no-op if running
- GET events: returns SSE response headers

**Verify:** `bun test src/api.test.ts`

---

## Phase 6: Scheduler

**Files:** `src/scheduler.ts`, `src/scheduler.test.ts`

`createScheduler({ db, sse, runBlock, tickIntervalMs?, maxConcurrency? })` returns `{ start, stop, tick, getState }`.

### Tests (mock runner, manual tick, in-memory db)
- Due block runs on tick
- Future block skipped
- Running block not re-triggered (per-block non-overlap)
- Concurrency cap: 3 due blocks + cap=2 → only 2 start
- next_run_at = finish_time + interval on success and error
- SSE broadcasts on running/success/error transitions
- Runner exception → block marked error, scheduler continues
- Deleted block mid-run → no crash

**Verify:** `bun test src/scheduler.test.ts`

---

## Phase 7: Server Assembly

**Files:** `src/server.ts`, `src/server.test.ts`

`createApp({ dbPath?, port?, runBlock?, tickIntervalMs? })` — factory. Auto-starts only when `import.meta.main`.

### Tests (mock runner, port 0, :memory: db)
- Server starts and responds to GET /api/blocks
- Full create → fetch flow
- Invalid input returns 400
- Server close() cleans up

**Verify:** `bun test src/server.test.ts && bun run check`

---

## Phase 8: Frontend

**Files:**
- `src/client/index.html`, `src/client/app.tsx`, `src/client/main.css`
- `src/client/components/App.tsx`, `CreateBlockForm.tsx`, `Feed.tsx`, `BlockCard.tsx`, `BlockBody.tsx`, `ErrorPanel.tsx`
- `src/client/lib/api.ts`, `src/client/lib/format.ts`
- `tests/e2e/test-server.ts`, `tests/e2e/app.spec.ts`, `playwright.config.ts`

### Playwright E2E tests (mock runner, :memory: db)
- Page loads with empty state
- Create block → appears in feed → runs → shows HTML
- Edit block → re-runs
- Delete block → disappears
- Refresh → enters running state
- Error state visible for failing mock
- Form validation (empty prompt, invalid interval)
- Multiple blocks in creation order
- SSE updates UI without manual refresh

**Verify:** `bun test && bunx playwright test`

---

## Phase 9: Polish & Full Verification

- Fix any remaining lint/test issues
- Run `bun run format` to normalize
- Manual smoke test with real `claude` CLI
- Add to `package.json`: `"check": "bunx @biomejs/biome check . && bun test && bunx playwright test"`

**Verify:** `bun run check` exits 0

---

## Critical File Paths

- `src/server.ts` — assembly point, `createApp(deps)` factory
- `src/runner.ts` — `RunBlockFn` type + `createCliRunner`/`createMockRunner`/`processCliOutput`
- `src/scheduler.ts` — `createScheduler(deps)` with exposed `tick()`
- `src/db.ts` — all functions take `Database` param
- `src/sanitize.ts` — `extractHtmlFromOutput` + `sanitizeBlockHtml`
- `src/prompts.ts` — `SYSTEM_PROMPT` (must stay in sync with sanitize config)
- `src/api.ts` — `createRouter(deps)`
- `src/sse.ts` — `createSseBroadcaster()`
