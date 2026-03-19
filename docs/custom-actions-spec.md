# Custom Actions — Technical Spec

## Overview

Custom actions are interactive links embedded in block markdown output. When Claude generates a block's content, it can include action links that navigate to a dedicated action page. Clicking an action link spawns a new Claude instance with the block's context, the action name, and any parameters — then displays the result.

## How it works

### 1. Action links in markdown

Block system prompts include instructions for generating action links. Claude outputs them as standard markdown links with a specific path format:

```
[Label](/action/{block-uuid}/{action-name}?optional=query&params)
```

With optional color tag (pipe-separated before the closing bracket):

```
[Label|red](/action/{block-uuid}/{action-name}?optional=query&params)
```

**Color palette:** `red`, `orange`, `yellow`, `green`, `blue`, `purple`. Default (no tag): `green`.

The system prompt includes guidance on semantic color usage: `red` for destructive/dangerous actions, `orange` for caution, `green` for safe/constructive, `blue` for informational/navigation, `purple` for advanced/settings. Claude picks the color based on the action's intent.

The `{block-uuid}` is provided to each block via its system prompt, so the block "knows" its own identity for constructing links.

### 2. Client-side routing

The app becomes a client-side routed SPA (using `history.pushState`, not hash-based):

- `/` — feed (existing home page)
- `/action/:uuid/:actionName` — action page

The server serves the same HTML entry point for all routes. Query params are preserved and passed through.

### 3. Action link rendering

The `marked` renderer is extended to detect `/action/` hrefs and render them differently:

- Pastel-colored background pill/badge (color from the tag or default green)
- Visually distinct from regular external links
- Parsed at render time: `[Label|color](href)` → extract color tag, render styled element

### 4. Action page flow

When a user navigates to `/action/{uuid}/{name}?params`:

1. **Generate action-click-id** — a unique ID for this specific click (e.g., `crypto.randomUUID()`). Appended to URL as `?...&_cid={id}` via `replaceState` so refreshes reuse the same ID.
2. **POST `/api/actions/run`** with `{ clickId, blockUuid, actionName, params }`.
3. **Server validates** the block UUID exists, loads the block's latest `output_markdown`.
4. **Server checks** if an `action_runs` row with this `clickId` already exists:
   - If `status = "completed"` or `status = "error"` → return cached result immediately.
   - If `status = "running"` → return running status (client listens for SSE).
   - If not found → create row, spawn Claude CLI.
5. **Server spawns Claude** with a composed prompt (see below), waits for completion, stores result in `action_runs`.
6. **Server broadcasts** `"action-updated"` SSE event with `{ clickId, status }` on completion or error. The action page listens on the existing SSE endpoint — no new SSE channel needed.
7. **Client receives SSE** → fetches result via `GET /api/actions/{clickId}`.
8. **Page renders** the result as rendered markdown (same `marked` pipeline as block cards). Action links in the result open new action pages (nested actions work naturally).

### 5. Action prompt composition

The prompt sent to Claude is composed of these parts, in order:

```
[Hardcoded action system prompt — instructions for Claude on how to behave during actions]

--- Block Context ---
{block's latest output_markdown}

--- Action ---
Action: {actionName}
Parameters: {key=value pairs from query string, one per line}
```

The system prompt is passed via `--append-system-prompt` (same pattern as block runs).

### 6. Server: `action_runs` table

```sql
CREATE TABLE IF NOT EXISTS action_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  click_id TEXT NOT NULL UNIQUE,
  block_id INTEGER NOT NULL,
  action_name TEXT NOT NULL,
  params TEXT,              -- JSON string of query params
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | running | completed | error
  output_markdown TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
```

**Cleanup job:** runs on scheduler tick (piggyback on existing 10s interval). Deletes rows where `created_at` is older than 24 hours.

### 7. Concurrency

Action runs **bypass the global concurrency cap of 2**. They are user-initiated, interactive, and blocking the user behind scheduled runs would feel broken. The concurrency cap remains for scheduled block runs only.

### 8. Block staleness after action

When an action completes successfully, the parent block is marked as **stale** client-side. When the user navigates back to the feed (`/`), stale blocks are automatically refreshed (via the existing `POST /api/blocks/:id/refresh` endpoint). This ensures the block reflects any external state changes caused by the action, without eagerly refreshing while the user is still on the action page.

### 9. Action page UI

- **Header:** action name + block title (extracted from block output), back link to feed (`/`)
- **Body:** rendered markdown result (same styling as block cards), or skeleton/spinner while running
- **Error state:** clear error message with "Go back to feed" link
- **Debug section:** expandable "Show prompt" that displays the full composed prompt sent to Claude

### 10. API endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/actions/run` | Start an action run (idempotent by `clickId`) |
| `GET` | `/api/actions/:clickId` | Get action run status and result |

## File changes summary

| Area | Changes |
|------|---------|
| `db.ts` | Add `action_runs` table to `initDb()` |
| `api.ts` | Add action endpoints, broadcast `action-updated` SSE on completion |
| `runner.ts` | Reuse `createCliRunner` — actions use the same runner with a different prompt |
| `scheduler.ts` | Add cleanup job for expired `action_runs` on tick |
| `sse.ts` | Add `"action-updated"` event type (no structural changes) |
| `types.ts` | Add `ActionRun` type + zod schema |
| `client/index.html` | Remains the single entry point |
| `client/components/App.tsx` | Add client-side router (pushState-based), track stale blocks, refresh on feed return |
| `client/components/ActionPage.tsx` | New — action page component |
| `client/lib/marked.ts` | Extend renderer to style action links + parse color tags |
| `client/lib/api.ts` | Add action API fetch wrappers |
| `server.ts` | Serve index.html for `/action/*` routes (SPA fallback) |

## Future improvements

- **Real-time streaming** — stream Claude CLI stdout to the action page via SSE instead of polling for completed result. Requires per-action SSE channel, piping `proc.stdout` incrementally.
- **User-defined actions prompt** — per-block or global "actions prompt" field where users can customize how Claude handles actions. Overrides the hardcoded system prompt.
- **Conversational actions** — ability to send follow-up messages on the action page (multi-turn conversation with Claude). The action page becomes a lightweight chat interface.
- **Action link linting** — validate action link format in block output post-run. Flag malformed links (bad UUID, missing action name) and surface warnings in block info popover.
- **Nested action history** — breadcrumb trail showing the chain of actions that led to the current page. Navigate back through parent actions.
