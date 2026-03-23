# Floudeck - CLAUDE.md

Floudeck is a local Bun app: server runs scheduled prompts through Claude Code CLI and renders GFM markdown output in a feed.

For maintenance guidelines, see @.claude/skills/maintain-claude-md/SKILL.md

## Key project documents

Keep in sync with the codebase after every implementation phase:

- **SPEC.md** — product spec (no implementation details)
- **README.md** — public-facing overview, quick start
- **CLAUDE.md** (this file) — rules, gotchas, decisions for agents
- **TODO.md** — upcoming work
- **docs/screenshot.png** — regenerate (`bun run scripts/screenshot.ts`) when app visuals change

## Commands

```bash
bun run dev                # start the app (port 3000)
bun run test               # unit tests
bun run e2e                # Playwright E2E tests
bun run check              # lint + unit tests + E2E
bun run lint               # biome check
bun run format             # biome auto-fix
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

## Gotchas

- **`proc.killed` unreliable in Bun**: Timeout detection uses an explicit `timedOut` flag — `proc.killed` reports true even for normally exited processes.
- **SSE idle timeout**: `Bun.serve()` needs `idleTimeout: 255` to prevent SSE connections from being dropped after 10s default.
- **`--append-system-prompt`**: Runner uses `--append-system-prompt` (not `--system-prompt`) to keep Claude Code's default system prompt intact.
- **Permission modes**: `"default"` (no flag) and `"dangerouslySkipPermissions"` (`--dangerously-skip-permissions`). Sandbox is configured in Claude Code settings, not by Floudeck.
- **cwd is per-block only**: Block override or auto-generated `~/.floudeck/blocks-workspace/{uuid}`. Not configurable globally.
- **Env inherit sentinel**: `$__FLOUDECK_INHERIT__` in env config means "read from host process env at runtime".
- **Markdown XSS model**: `javascript:` URLs in links/images are rendered as-is (Claude's output is trusted). Add link sanitization if the app becomes user-editable or public-facing.
- **Action link format**: `[Label|color](/action/{block-uuid}/{action-name}?params)` — rendered as pastel-colored pills. Color tags on external links render as colored underlined text. All external links open in new tab.
