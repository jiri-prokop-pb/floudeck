# Floudeck - CLAUDE.md

**This file is a living document.** Whenever you hit a non-obvious problem, make a decision, or discover something that deviates from the spec/plan, record it here immediately. Future agents and sessions must check this file first and follow what's written. This prevents re-discovering the same issues and flip-flopping on decisions.

## What is this

Floudeck is a local PoC: a Bun app that runs scheduled prompts through Claude Code CLI and renders sanitized HTML output in a feed. See SPEC.md for product spec, PLAN.md for implementation plan.

## Stack

- **Runtime**: Bun only (server, bundler, package manager, SQLite)
- **Backend**: `Bun.serve()`, `bun:sqlite`, `Bun.spawn()`
- **Frontend**: Bun HTML imports, minimal React, Tailwind via `bun-plugin-tailwind`
- **Sanitization**: `sanitize-html`
- **No**: ORM, state library, router, websockets, cron library, worker processes

## Commands

```bash
bun run src/server.ts      # start the app (port 3000)
bun install                # install deps
```

## Project structure

All source lives in `/src`. Backend modules are at the root of `/src`, client code is in `/src/client`. See PLAN.md section 3 for the full tree.

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
- **HTML sanitization is mandatory.** Both the system prompt and `sanitize.ts` share the same allow-list. If you change one, change the other.
- **All API endpoints use POST for mutations** (not PUT/PATCH/DELETE). This is a deliberate PoC simplification.
- **No history/logs table.** Only the latest output per block is stored.

## Frontend rules

- This is a Bun app with a thin React layer, not a React app. Keep it minimal.
- No SPA router, no global state library.
- Use `dangerouslySetInnerHTML` only for server-sanitized `output_html`.
- Tailwind classes inline. No CSS modules or styled-components.

## Decisions log

Record non-obvious decisions here as they come up during implementation. Format: `- **topic**: decision (reason)`

<!-- Add entries below as you work -->
