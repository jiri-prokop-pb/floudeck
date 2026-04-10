# Floudeck - CLAUDE.md

Floudeck is a local Bun app: server runs scheduled prompts through Claude Code CLI and renders GFM markdown output in a feed.

Skills: @.claude/skills/frontend-dev/SKILL.md | @.claude/skills/backend-dev/SKILL.md | @.claude/skills/testing/SKILL.md | @.claude/skills/workflows/SKILL.md | @.claude/skills/maintain-claude-md/SKILL.md

## Key project documents

Keep in sync with the codebase after every implementation phase:

- **SPEC.md** — product spec (no implementation details)
- **README.md** — public-facing overview, quick start
- **CLAUDE.md** (this file) — rules, gotchas, decisions for agents
- **TODO.md** — upcoming work. Remove completed items, add new ones as they emerge
- **docs/screenshot.png** — regenerate (`bun run scripts/screenshot.ts`) when app visuals change

## Stack

- **Runtime**: Bun only (server, bundler, package manager, SQLite)
- **Backend**: `Bun.serve()`, `bun:sqlite`, `Bun.spawn()`
- **Frontend**: Bun HTML imports (dev), pre-built static assets (production), minimal React, Tailwind via `bun-plugin-tailwind`
- **Markdown**: `marked` (client-side GFM rendering)
- **Desktop**: Tauri v2 (native webview shell, sidecar lifecycle)
- **No**: ORM, state library, router, websockets, cron library, worker processes

## Commands

```bash
bun run dev                # start the app (port 3000, HTML imports + HMR)
bun run build:server       # compile server binary + bundle client assets
bun run build              # build:server + cargo tauri build (.app/.dmg)
bun run test               # unit tests
bun run e2e                # Playwright E2E tests
bun run check              # lint + unit tests + E2E
bun run lint               # biome check
bun run format             # biome auto-fix
bun run bump <version>     # bump version in all 3 files (package.json, tauri.conf.json, Cargo.toml)
```

## Rules

- **No type casting (`as`) or non-null assertions (`!`).** Use `satisfies`, guards, or restructure code. In tests, use helper functions with runtime guards (e.g. `if (!x) throw`) instead of `!`.
- **Prefer Bun primitives over `node:*` imports.** `Bun.file().exists()` not `existsSync`, template literals not `path.join`. Fall back to `node:*` only when no Bun equivalent exists.
- **Never use `bunx`** for locally installed packages — `bun <pkg>` resolves local binaries.
- **All timestamps are ISO UTC strings.** Use `time.ts` helpers, not raw `new Date()`.
- **All API endpoints use POST for mutations** (not PUT/PATCH/DELETE).
- **SQLite schema lives in `db.ts`** — `initDb()` creates tables if missing.
- **Scheduler is a single `setInterval` tick every 10s**, not per-block timers.
- **Global concurrency cap is 2.** Per-block overlap is forbidden.
- **"Immediate run" means `next_run_at = now`** — scheduler picks it up on next tick. Never run inline from API handlers.
- **Action runs bypass the concurrency cap** — they're user-initiated and run independently of the scheduler.
- **SSE is notification-only.** Small `{ blockId, status }` payloads. Client refetches via JSON endpoints.
- **No history/logs table.** Only the latest output per block is stored.
- **Dependency injection via factory functions everywhere** — no module-level singletons, no monkey-patching.
- Two files named `api.ts` exist on purpose: `src/api.ts` (server routes) and `src/client/lib/api.ts` (client fetch wrappers).
- **Prefer React 19 patterns** (`use()`, `useActionState`, `<Suspense>`) over `useEffect`+`useState` for data fetching and form submission state. Consult the frontend-dev skill when in doubt.
- **Git: rebase, not merge.** PR merge strategy is "Rebase and merge". When resolving conflicts with main, use `git rebase origin/main` + force push (with lease), never `git merge`.
- **Lefthook pre-commit hook** runs `bun run lint` on every commit. Installed automatically via `postinstall`. If the hook fails, run `bun run format` to fix, then re-commit.
- **Pin all dependency versions** — no `^` or `~` ranges in `package.json`. `bunfig.toml` has `exact = true` so `bun add` defaults to exact versions. Caret ranges cause version drift between local and CI.

### Releasing

Use the `/release` slash command. It analyzes changes since the last release tag, suggests a version bump (patch/minor/major), runs `bun run bump <version>` to update `package.json`, `tauri.conf.json`, and `Cargo.toml`, then opens a PR titled `Release v<version>`. CI validates the release PR (version consistency + full Tauri build). On merge to `main`, the release workflow detects the version change, builds the DMG, and creates a GitHub release with the artifact.

### Packaging / Tauri

- `src-tauri/` — Tauri v2 Rust shell. Spawns the Bun-compiled server binary as a sidecar.
- `src/paths.ts` — centralized data directory (`~/.floudeck/`), claude CLI path resolution, client assets path.
- `scripts/build.ts` — two-phase build: bundles frontend via `Bun.build()`, compiles server via `bun build --compile`.
- Dev vs production mode is determined by `--client-dir` flag. Without it (default): HTML imports + HMR. With it (Tauri sidecar): serves pre-built static files.
- Server binary accepts `--port`, `--data-dir`, `--client-dir`, `--version` CLI flags.
- DB migrations use `PRAGMA user_version` (framework in `db.ts`, initial schema = version 1).

## Gotchas

- **`proc.killed` unreliable in Bun**: Timeout detection uses an explicit `timedOut` flag — `proc.killed` reports true even for normally exited processes.
- **SSE idle timeout**: `Bun.serve()` needs `idleTimeout: 255` to prevent SSE connections from being dropped after 10s default.
- **`--append-system-prompt`**: Runner uses `--append-system-prompt` (not `--system-prompt`) to keep Claude Code's default system prompt intact.
- **Permission modes**: `"default"` (no flag) and `"dangerouslySkipPermissions"` (`--dangerously-skip-permissions`). Sandbox is configured in Claude Code settings, not by Floudeck.
- **cwd is per-block only**: Block override or auto-generated `~/.floudeck/blocks-workspace/{uuid}`. Not configurable globally.
- **Env inherit sentinel**: `$__FLOUDECK_INHERIT__` in env config means "read from host process env at runtime".
- **Markdown XSS model**: `javascript:` URLs in links/images are rendered as-is (Claude's output is trusted). Add link sanitization if the app becomes user-editable or public-facing.
- **Action link format**: `[Label|color](/action/{block-uuid}/{action-name}?params)` — rendered as pastel-colored pills. Color tags on external links render as colored underlined text. All external links open in new tab.
- **Claude CLI resolution**: On startup, resolves `claude` binary path via `which`, then checks common locations (`~/.claude/local/claude`, `/usr/local/bin/claude`, `/opt/homebrew/bin/claude`). Cached for process lifetime. Necessary because Finder-launched apps have minimal `$PATH`.
- **Tauri sidecar**: Server binary is bundled as Tauri external binary. Launched with `--port 0`, prints assigned port to stdout, Tauri reads it and navigates webview. Killed on window close.
- **Port handling**: Dev mode defaults to port 3000. Sidecar mode uses port 0 (OS-assigned). Explicit `--port` flag overrides both.
- **Tauri title bar**: Uses `titleBarStyle: "Overlay"` with a transparent drag region div. Dragging and double-click-to-maximize are handled via Tauri commands (`drag_window`, `toggle_maximize`) invoked from React, not `data-tauri-drag-region`.
- **Client assets dir**: Tauri passes `--client-dir` pointing to its resource dir so the sidecar can find pre-built frontend files. In dev mode, static assets from `src/client/assets/` are served via the fetch handler.
- **Logo / retina**: `src/client/assets/` contains `logo.png` (1x), `logo@2x.png`, `logo@3x.png`. Build script copies the assets dir to `dist/client/`. Use `srcSet` for retina support.
- **Tauri generated files**: `src-tauri/gen/` is gitignored — regenerated by `cargo tauri build`/`cargo tauri dev`.
- **Remotion uses `remotionb`**: The promo video (`promo/`) uses `remotionb` (not `remotion`) as the CLI command — this is the [Bun-specific variant](https://www.remotion.dev/docs/bun#as-a-package-manager). Do not "fix" this to `remotion`.

## Testability architecture

Every module uses **dependency injection via factory functions** — no module-level singletons, no monkey-patching.

| Module | Injection point | Test strategy |
|--------|----------------|---------------|
| `db.ts` | All functions take `Database` param | `:memory:` SQLite per test |
| `config.ts` | Pure functions: `resolveRunnerConfig`, `buildCliArgs` | Direct unit tests with config objects |
| `runner.ts` | `RunBlockFn` type; `createRunner(systemPrompt)` / `createMockRunner()` factories | Tests use mock runner or test `processCliOutput()` pure function directly |
| `scheduler.ts` | `createScheduler(deps)` returns `{ start, stop, tick }` | Tests call `tick()` directly, no timers |
| `api.ts` | `createRouter(deps)` takes db, sse, triggerRun | In-memory db + real SSE broadcaster |
| `server.ts` | `createApp(deps)` factory; auto-starts only via `import.meta.main` | Tests create isolated instances on port 0 |
| `paths.ts` | Module-level state via `setDataDir()`, `setClaudePath()` | Override in tests; pure functions for resolution |
| `sse.ts` | `createSseBroadcaster()` factory | Unit test broadcast/client management |

## Browser Automation

Use `agent-browser` for web automation. Run `agent-browser --help` for all commands. Or activate `/agent-browser` skill.

Core workflow:

1. `agent-browser open <url>` - Navigate to page
2. `agent-browser snapshot -i` - Get interactive elements with refs (@e1, @e2)
3. `agent-browser click @e1` / `fill @e2 "text"` - Interact using refs
4. Re-snapshot after page changes
