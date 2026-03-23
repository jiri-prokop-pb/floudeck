---
name: testing
description: Testing conventions — bun:test unit tests and Playwright E2E tests, DI patterns, mock strategies, when to use which
---

# Testing conventions

## When to use what

| Scenario | Use |
|----------|-----|
| Pure function logic (config, validation, formatting, time) | Unit test — no DI needed, just call the function |
| Module with side effects (db, scheduler, SSE, runner) | Unit test with DI — inject `:memory:` db, mock runner, etc. |
| API route handlers | Unit test — pass `Request` objects directly to the router function, no HTTP server |
| Full server integration (routing, middleware, bundling) | Unit test with `createApp({ port: 0 })` — real server, OS-assigned port |
| User-facing flows (create block, edit, delete, SSE updates) | E2E Playwright test |

**Prefer unit tests.** E2E tests are for verifying user-facing flows that span the full stack. If you can test it with a pure function call or DI, do that instead.

**Prefer running single test files** (`bun test src/foo.test.ts`), not the whole suite, for faster feedback.

## Unit tests — bun:test

### Basics

- Runner: `bun:test` exclusively. Command: `bun test src/`
- Test files live alongside source: `src/foo.ts` → `src/foo.test.ts`
- Structure: `describe` + `test` blocks (never `it`)
- No shared test utility files — helpers are local to each test file

### DI patterns per module

**Database tests** (`db.test.ts`):
```ts
let db: Database;
beforeEach(() => { db = initDb(); }); // :memory: SQLite
```
Runtime guard helper instead of `!`:
```ts
function mustGetBlock(db: Database, id: number) {
  const b = getBlock(db, id);
  if (!b) throw new Error(`block ${id} not found`);
  return b;
}
```

**Scheduler tests** (`scheduler.test.ts`):
- `createScheduler({ db, sse, runBlock })` with all deps injected
- Call `await scheduler.tick()` directly — no timers
- Mock runner via `createMockRunner(fn)` where `fn` receives the prompt
- Concurrency tests use real `setTimeout` delays inside mock runners to create async overlap

**API tests** (`api.test.ts`):
- `createRouter({ db, sse, triggerRun, runAction })` returns a handler function
- Pass `new Request("http://localhost/api/...")` directly — no HTTP server needed
- Local helpers: `req(method, path, body?)` builds requests, `jsonBody(res)` parses responses
- `triggerRun` is a plain arrow function pushing to an array

**Server tests** (`server.test.ts`):
- `createApp({ port: 0, runBlock: createMockRunner(...), tickIntervalMs: 100_000 })`
- Port 0 = OS-assigned port, read via `app.server.port`
- Requests via `app.server.fetch(new Request(...))` — Bun's built-in `.fetch()`, no real TCP
- Cleanup: `afterEach(() => { app?.close(); app = null; })`
- `tickIntervalMs: 100_000` prevents auto-ticks during tests

**Runner tests** (`runner.test.ts`):
- Test `processCliOutput(stdout, stderr, exitCode)` as a pure function — no process spawning
- Discriminated union narrowing: `if (result.ok) { ... }` / `if (!result.ok) { ... }`

**SSE tests** (`sse.test.ts`):
- `createSseBroadcaster()` per test, `afterEach(() => { sse?.close(); })`
- Read SSE frames by calling `sse.close()` after broadcast, then `await response.text()`

**Pure function tests** (config, validate, extract, prompts, time, format, markdown):
- No DI, no lifecycle hooks. Just `test` + `expect`.

### Rules for tests

- **No `as` casts.** Use runtime guards (`if (!x) throw`) or discriminated union narrowing (`if (result.ok)`)
- **No `!` assertions.** Biome warns on `noNonNullAssertion`. Use `mustGet*` helpers with runtime guards.
- **No shared test utilities file.** Helpers are local per test file (e.g. `mustGetBlock` is copy-pasted where needed).
- **`spyOn` is the only mocking tool.** No jest.mock, no module-level patches. Prefer real implementations (`:memory:` db, `Bun.serve` port 0) over mocks.

## E2E tests — Playwright

### Setup

- Config: `playwright.config.ts` — Chromium only, headless
- Tests: `tests/e2e/app.spec.ts`
- Command: `bun run e2e` (runs `scripts/run-e2e.ts`)

### How the test server works

1. `run-e2e.ts` finds a free port (bind to port 0, read, close), spawns Playwright with `E2E_PORT`
2. Playwright's `webServer` runs `tests/e2e/test-server.ts` which starts `createApp({ port, runBlock: mockRunner, tickIntervalMs: 500 })`
3. Mock runner returns markdown after 200ms delay; prompts containing "fail" return errors
4. `reuseExistingServer: !process.env.CI`

### Test structure

- No `describe` — all tests are top-level `test()` blocks
- `test.beforeEach`: fetches all blocks via API and deletes them, then navigates to `/`
- No `afterEach` — server uses `:memory:` SQLite

### Local helpers

```ts
createBlock(page, prompt, interval, unit?)  // opens modal, fills form, submits
clickCardMenu(page, action, index?)         // clicks nth menu button, selects action
```

### Selectors

Mixed strategy, no `data-testid`:
- Text: `page.click("text=+ Add another block")`
- Attribute: `page.locator('[title="Menu"]')`
- Element type: `page.fill("textarea", ...)`
- Role: `page.getByRole("heading", { name: "Task failed" })`

### Flows covered

1. Empty state rendering
2. Create block → runs → shows markdown output
3. Edit block → re-runs with new prompt
4. Delete block (dialog confirmation) → empty state
5. Refresh block → re-runs
6. Error state (prompt contains "fail")
7. Form validation — empty prompt shows error
8. Multiple blocks in creation order
9. SSE updates UI without manual refresh
