# Review

Date: 2026-03-13

## Scope

I reviewed the current implementation, read the unit and E2E tests, and ran the documented repo commands:

- `bun run dev`
- `bun run test`
- `bun run lint`
- `bun run e2e`

After installing dependencies with `bun install`, the repository still does not reach a clean green state. The findings below are based on the current code and on those command results.

## Findings

### P1. Quick start is broken from a fresh checkout

`bun run dev` currently fails before the server starts:

- `src/server.ts` starts the app with `dbPath: "data/floudeck.sqlite"`
- `src/db.ts` opens that path directly
- the repository ignores `data/` and does not create it automatically

Observed result:

- `SQLiteError: unable to open database file`

This means the README quick start is not reproducible as written.

Files:

- `README.md`
- `src/server.ts`
- `src/db.ts`

### P1. Server integration tests are currently dead

`src/server.test.ts` starts the server with `port: 0`, expecting an ephemeral port. Under the current Bun version in this environment (`1.3.10`), `Bun.serve` throws:

- `Failed to start server. Is port 0 in use?`
- `code: "EADDRINUSE"`

Observed result:

- `bun run test` ended with `81 pass / 4 fail`
- all 4 failures came from `src/server.test.ts`

The practical issue is that one part of the test strategy depends on behavior that does not currently hold.

Files:

- `src/server.test.ts`
- `src/server.ts`

### P1. Updating a block while it is running can schedule the next run with stale interval data

The scheduler captures `prompt`, `intervalValue`, and `intervalUnit` at run start. The API allows updates while a block is already in `running` state. If a block is edited mid-run, the row is updated in SQLite, but when the run finishes the scheduler still computes `next_run_at` using the stale interval values captured before the edit.

I reproduced this with an in-memory run:

- original interval: `1 hour`
- updated while running to: `2 days`
- final persisted `interval_unit` became `days`
- final persisted `next_run_at` was still only `+1 hour`

This is a correctness bug, not only a UX inconsistency.

Files:

- `src/scheduler.ts`
- `src/api.ts`
- `src/db.ts`

### P2. E2E is brittle because the port is hardcoded

The Playwright setup and the test server both default to port `3456`. If that port is already in use, `bun run e2e` fails before tests start.

Observed result:

- `Process from config.webServer was not able to start`
- underlying error: `EADDRINUSE`

This makes local DX worse than necessary and makes parallel local work harder.

Files:

- `playwright.config.ts`
- `tests/e2e/test-server.ts`

## Areas To Simplify

### 1. Consolidate request validation

`src/api.ts` duplicates the same prompt / interval validation logic in both create and update handlers, while `src/db.ts` also validates the same shape again. The repo should have one shared parser/validator for block input and use it consistently across server boundaries.

Likely improvement:

- add a small `parseBlockInput()` helper or schema
- return typed validated data once
- keep DB validation as a final guard, but remove route-level duplication

### 2. Reuse the block form between create and edit

`CreateBlockForm.tsx` and the edit section inside `BlockCard.tsx` duplicate:

- prompt field handling
- interval field handling
- number parsing
- loading behavior
- validation intent

This is a small codebase, so a shared form component would reduce state duplication and make behavior changes easier to keep consistent.

### 3. Tighten scheduler ownership of state transitions

The state model is simple, but today the scheduler reads the block once, runs work, and later writes based on stale captured values. That is the source of the mid-run edit bug.

A simpler and safer rule would be:

- after the runner returns, reload the block row
- compute `next_run_at` from the latest persisted schedule
- then persist the run result

That keeps scheduling decisions aligned with the current source of truth in SQLite.

## Test Gaps

The test suite is decent for a PoC, but it misses several paths that matter more than some of the currently covered happy paths.

### Missing or weakly covered cases

- editing a block while it is running
- startup behavior when the DB directory does not exist
- E2E / integration handling when the desired port is unavailable
- EventSource reconnect or missed-event recovery behavior
- client-side API failure behavior for network errors and non-JSON responses

### Lint/test mismatch

`bun run lint` currently reports a large set of `noNonNullAssertion` warnings, mostly in tests and in a few implementation spots. The lint config is stricter than the test code currently follows, which means `check` is not close to noise-free.

Files:

- `biome.json`
- `src/api.test.ts`
- `src/server.test.ts`
- implementation files using `!`

## Tooling And DX Review

### What is good

- small runtime surface area
- minimal architecture
- mockable runner design
- in-memory SQLite usage in most tests
- E2E tests exist at all, which is good for a small PoC

### Main DX problems

#### 1. Install / run is not deterministic enough

- `bun.lock` is ignored, so installs are not reproducible
- `typescript` is in `peerDependencies` instead of `devDependencies`
- `@types/bun` is pinned to `"latest"`

For a Bun-first app, that combination makes environment drift more likely than it should be.

Files:

- `.gitignore`
- `package.json`

#### 2. Local scripts depend on `bunx` even though the tools are local dependencies

Scripts such as `lint`, `format`, and `e2e` invoke `bunx`. That adds extra temp/cache dependence for tools that are already present in `node_modules`.

Safer options:

- use direct package binaries from installed deps
- or at least verify the scripts work in clean CI and constrained environments

Files:

- `package.json`

#### 3. Lint coverage is too narrow

`biome.json` only includes:

- `src/**`
- `*.json`
- `*.toml`

That excludes important executable project files:

- `playwright.config.ts`
- `tests/e2e/**`
- `scripts/**`

So some of the highest-friction tooling code is outside the main lint path.

Files:

- `biome.json`

#### 4. The documented command path is not green

At the moment:

- `bun run dev` fails from a fresh checkout
- `bun run test` fails in `src/server.test.ts`
- `bun run e2e` fails if port `3456` is occupied

This is the biggest DX problem in the repo. The command surface is small, but it is not yet reliable.

## Recommended Next Steps

### Highest priority

1. Make startup create the DB directory automatically, or choose a default path that always exists.
2. Fix the server integration test strategy so it does not rely on broken `port: 0` behavior.
3. Fix the mid-run edit scheduling bug by reloading the block after the runner completes.
4. Make Playwright choose a non-conflicting port or make the port selection more robust.

### Next priority

1. Commit `bun.lock`.
2. Move `typescript` to `devDependencies`.
3. Replace `@types/bun: "latest"` with a pinned version.
4. Expand Biome coverage to tests and scripts.
5. Remove duplicated block input validation and form logic.

## Bottom Line

The repository is structurally solid for a PoC: the modules are small, the boundaries are understandable, and the overall architecture is intentionally simple. The main weakness is not overengineering, but execution detail around correctness and developer ergonomics.

The two most important takeaways are:

1. there is at least one real scheduling correctness bug today
2. the advertised local command workflow is not yet dependable from a clean checkout

Fixing those first will improve both product reliability and day-to-day DX more than any larger refactor.
