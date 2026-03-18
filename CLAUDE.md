# Floudeck - CLAUDE.md

**This file is a living document.** Whenever you hit a non-obvious problem, make a decision, or discover something that deviates from the spec, record it here immediately. Future agents and sessions must check this file first and follow what's written. This prevents re-discovering the same issues and flip-flopping on decisions.

## What is this

Floudeck is a local app: a Bun server that runs scheduled prompts through Claude Code CLI and renders GFM markdown output in a feed.

## Key project documents

These documents are **living** and must be kept in sync with the codebase after every implementation phase:

- **SPEC.md** — product spec. What Floudeck does from a user/product perspective. No implementation details. Update when features are added, changed, or removed.
- **README.md** — public-facing overview, quick start, feature list. Update when user-visible functionality changes.
- **CLAUDE.md** (this file) — technical rules, decisions, architecture for agents. Update when implementation patterns or decisions change.
- **TODO.md** — upcoming work. Remove completed items, add new ones as they emerge.
- **docs/screenshot.png** — regenerate (`bun run scripts/screenshot.ts`) when app visuals change.

## Stack

- **Runtime**: Bun only (server, bundler, package manager, SQLite)
- **Backend**: `Bun.serve()`, `bun:sqlite`, `Bun.spawn()`
- **Frontend**: Bun HTML imports, minimal React, Tailwind via `bun-plugin-tailwind`
- **Markdown**: `marked` (client-side GFM rendering)
- **No**: ORM, state library, router, websockets, cron library, worker processes

## Commands

```bash
bun run dev                # start the app (port 3000)
bun run test               # unit tests (142 tests)
bun run e2e                # Playwright E2E tests (9 tests)
bun run check              # lint + unit tests + E2E
bun run lint               # biome check
bun run format             # biome auto-fix
bun install                # install deps
```

## Project structure

All source lives in `/src`. Backend modules are at the root of `/src`, client code is in `/src/client`.

Two files named `api.ts` exist on purpose:
- `src/api.ts` — server-side route handlers
- `src/client/lib/api.ts` — client-side fetch wrappers

## Key rules

- **SQLite schema lives in `db.ts`** — no separate schema file. `initDb()` creates tables if missing.
- **All timestamps are ISO UTC strings.** Use `time.ts` helpers, not raw `new Date()` scattered around.
- **Scheduler is a single `setInterval` tick every 10s**, not per-block timers. This is a deliberate design choice for robustness.
- **Global concurrency cap is 2.** Per-block overlap is forbidden.
- **"Immediate run" means `next_run_at = now`**, letting the scheduler pick it up on the next tick. Do not run inline from API handlers.
- **SSE is notification-only.** Payloads are small `{ blockId, status }` objects. Client refetches actual data via JSON endpoints.
- **SSE keepalive every 20 seconds.**
- **Claude outputs GFM markdown.** Backend stores markdown as-is. Frontend renders with `marked` (raw HTML stripped by custom renderer).
- **All API endpoints use POST for mutations** (not PUT/PATCH/DELETE). This is a deliberate PoC simplification.
- **No history/logs table.** Only the latest output per block is stored.
- **Prefer Bun primitives over `node:*` imports.** Use `Bun.file().exists()` instead of `existsSync`, template literal paths instead of `path.join`, etc. Fall back to `node:fs`/`node:path` only when no Bun equivalent exists (e.g. `mkdirSync`).
- **Never use `bunx` for locally installed packages.** Use `bun <pkg>` which resolves local binaries automatically.
- **No type casting (`as`).** Use `satisfies`, `spyOn`, proper interfaces, or restructure code to avoid `as` casts entirely. Prefer using real implementations (e.g. `Bun.serve` with port 0) over mocks that need casts to match complex types.

## Frontend rules

- This is a Bun app with a thin React layer, not a React app. Keep it minimal.
- No SPA router, no global state library.
- Use `dangerouslySetInnerHTML` only for `marked`-rendered markdown content (raw HTML stripped by custom renderer).
- Tailwind classes inline. No CSS modules or styled-components.

## Decisions log

Record non-obvious decisions here as they come up during implementation. Format: `- **topic**: decision (reason)`

- **Tailwind v4**: CSS uses `@import "tailwindcss"` (not v3 `@tailwind` directives). `tailwindcss` must be a runtime dependency.
- **Bun HTML imports**: Server uses `import homepage from "./client/index.html"` + `routes: { "/": homepage }` for bundling. Raw `Bun.file()` serving won't bundle TSX/CSS.
- **`--append-system-prompt`**: Runner uses `--append-system-prompt` (not `--system-prompt`) to keep Claude Code's default system prompt intact.
- **Permission modes**: `"default"` (no flag — respects user's Claude Code settings including sandbox) and `"dangerouslySkipPermissions"` (passes `--dangerously-skip-permissions`). Sandbox is configured in Claude Code's own settings, not by Floudeck.
- **Runner config**: `blocks.runner_config` is a nullable JSON column. Per-block overrides global, global overrides hardcoded defaults. Lenient parsing — unknown keys ignored.
- **cwd is per-block only**: Block override or auto-generated `~/.floudeck/blocks-workspace/{uuid}`. Not configurable globally.
- **Env inherit sentinel**: `$__FLOUDECK_INHERIT__` in env config means "read from host process env at runtime".
- **Block UUIDs**: Each block gets a `uuid` column (via `crypto.randomUUID()`) used for workspace directory naming.
- **`proc.killed` unreliable in Bun**: Timeout detection uses an explicit `timedOut` flag instead of `proc.killed` which reports true even for normally exited processes.
- **SSE idle timeout**: `Bun.serve()` needs `idleTimeout: 255` to prevent SSE connections from being dropped after 10s default.
- **README screenshot**: Run `bun run scripts/screenshot.ts` to regenerate `docs/screenshot.png`. Do this when changing app visuals/functionality.
- **`marked` for markdown**: Switched from `sanitize-html` to `marked` for client-side GFM rendering. Custom renderer strips raw HTML tokens. Title extracted from first `# Heading` in output.
- **Markdown XSS model**: Links and images with `javascript:` URLs are rendered as-is because Claude's output is trusted. If the app becomes user-editable or public-facing, add link sanitization (e.g., custom `marked` link renderer that rejects non-http(s) schemes).
- **zod/mini for JSON parsing**: All `JSON.parse` of structured data uses `zod/mini` schema (`safeParse`). Never cast parsed JSON with `as`. Schemas live in `types.ts` next to derived types.
- **@phosphor-icons/react**: All icons use `@phosphor-icons/react` with `weight="bold"`. No inline SVGs or Unicode icon characters.

## Testability architecture

Every module uses **dependency injection via factory functions** — no module-level singletons, no monkey-patching.

| Module | Injection point | Test strategy |
|--------|----------------|---------------|
| `db.ts` | All functions take `Database` param | `:memory:` SQLite per test |
| `config.ts` | Pure functions: `resolveRunnerConfig`, `buildCliArgs` | Direct unit tests with config objects |
| `runner.ts` | `RunBlockFn` type; `createCliRunner()` / `createMockRunner()` factories | Tests use mock runner or test `processCliOutput()` pure function directly |
| `scheduler.ts` | `createScheduler(deps)` returns `{ start, stop, tick }` | Tests call `tick()` directly, no timers |
| `api.ts` | `createRouter(deps)` takes db, sse, triggerRun | In-memory db + real SSE broadcaster |
| `server.ts` | `createApp(deps)` factory; auto-starts only via `import.meta.main` | Tests create isolated instances on port 0 |
| `sse.ts` | `createSseBroadcaster()` factory | Unit test broadcast/client management |
