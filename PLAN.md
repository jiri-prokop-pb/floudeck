# Floudeck Technical Implementation Plan v2

## Objective

Implement the Floudeck PoC as a very small Bun application with:

- Bun server
- SQLite via Bun native API
- Bun HTML/static frontend pipeline
- minimal React client
- Tailwind via Bun plugin
- scheduled execution of Claude Code CLI
- sanitized HTML block output
- SSE notifications for server → client updates

This plan translates the product spec into concrete implementation steps, package choices, route contracts, runtime rules, and a suggested build order.

---

## 1. Technical Stack

### Runtime

- **Bun** as the only runtime for server, build, and package management

### Backend

- `Bun.serve()` for HTTP server
- `bun:sqlite` for SQLite access
- `Bun.spawn()` for Claude Code CLI execution
- SSE endpoint for update notifications

### Frontend

- Bun HTML/static bundling
- minimal React
- Tailwind via Bun plugin
- native browser `EventSource`

### Sanitization

- `sanitize-html`

### Optional utility packages

Only add these if they clearly reduce code without adding architectural weight:

- `zod` for request validation

For the current PoC, even `zod` is optional.

---

## 2. Dependencies

### Required packages

```bash
bun add react react-dom sanitize-html
bun add -d bun-plugin-tailwind typescript @types/react @types/react-dom @types/sanitize-html
```

If Bun’s current Tailwind plugin packaging or naming differs at implementation time, follow the Bun docs and keep the rest of the plan unchanged.

### Avoid

Do not add:

- ORM
- state library
- router library
- websocket library
- background job framework
- cron library

---

## 3. Project Structure

```text
floudeck/
  bunfig.toml
  package.json
  tsconfig.json
  /data
    floudeck.sqlite
  /src
    server.ts
    db.ts
    scheduler.ts
    runner.ts
    prompts.ts
    sanitize.ts
    time.ts
    types.ts
    api.ts
    sse.ts
    /client
      index.html
      app.tsx
      main.css
      /components
        App.tsx
        CreateBlockForm.tsx
        Feed.tsx
        BlockCard.tsx
        BlockBody.tsx
        ErrorPanel.tsx
      /lib
        api.ts
        format.ts
```

Note: `src/api.ts` contains server-side route handlers. `src/client/lib/api.ts` contains client-side fetch helpers.

---

## 4. Bun Configuration

### `bunfig.toml`

Draft shape:

```toml
[install]
exact = false

[run]
bun = true

[serve.static]
plugins = ["bun-plugin-tailwind"]
```

Use the exact Tailwind plugin wiring recommended by Bun docs at implementation time.

---

## 5. Type Model

```ts
export type IntervalUnit = "minutes" | "hours" | "days";
export type BlockStatus = "idle" | "running" | "success" | "error";

export type BlockRecord = {
  id: number;
  prompt: string;
  interval_value: number;
  interval_unit: IntervalUnit;
  status: BlockStatus;
  output_html: string | null;
  error_text: string | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
  running_started_at: string | null;
};
```

---

## 6. Database Schema

```sql
CREATE TABLE IF NOT EXISTS blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  interval_value INTEGER NOT NULL,
  interval_unit TEXT NOT NULL CHECK(interval_unit IN ('minutes', 'hours', 'days')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'success', 'error')),
  output_html TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT,
  next_run_at TEXT,
  running_started_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_blocks_next_run_at ON blocks(next_run_at);
```

---

## 7. Database Access Layer

Required functions in `db.ts`:

- `initDb()`
- `listBlocks()`
- `getBlock(id)`
- `createBlock(input)`
- `updateBlock(id, input)`
- `deleteBlock(id)`
- `markBlockRunning(id, startedAt)`
- `markBlockSuccess(id, outputHtml, finishedAt, nextRunAt)`
- `markBlockError(id, errorText, finishedAt, nextRunAt)`
- `findDueBlocks(now, limit)`
- `resetStaleRunningBlocksOnStartup(now)`

Every state transition should go through this layer.

---

## 8. Time Utilities

Add one tiny `time.ts` with:

- `nowIso()`
- `addInterval(baseIso, value, unit)`
- `isDue(nextRunAt, nowIso)`
- `formatSchedule(value, unit)`

Persist all timestamps in ISO UTC strings.

---

## 9. Claude Runner Contract

`runner.ts` should:

- assemble the full prompt payload
- spawn the Claude Code CLI process
- capture stdout/stderr
- enforce timeout
- parse reasoning/output delimiters
- sanitize HTML
- return a typed success/error result

### Result shape

```ts
type RunResult =
  | { ok: true; html: string; rawHtml: string; reasoning: string | null }
  | { ok: false; error: string; stderr?: string };
```

### Runner steps

1. load system prompt from `prompts.ts`
2. pass block prompt as user prompt
3. spawn CLI with safe argument handling
4. collect stdout/stderr
5. timeout after 60s
6. extract `===BEGIN_HTML=== ... ===END_HTML===`
7. sanitize fragment
8. if empty/invalid after sanitization, fail
9. return sanitized HTML

The exact CLI invocation may vary by Claude Code version, so isolate it behind one function.

---

## 10. Prompt Definitions

`prompts.ts` should contain one exported `SYSTEM_PROMPT` string.

It should include:

- Floudeck purpose
- role of the generated block
- output-only HTML requirement
- allowed tags/attributes
- reasoning delimiters
- HTML delimiters
- quality guidance

Also include guidance like:

- prefer concise structure
- avoid overlong prose
- highlight important signals
- use tables only when clearly useful
- links should include `target="_blank"` and `rel="noopener noreferrer"` if external

---

## 11. Sanitizer Configuration

`sanitize.ts` should export:

- `sanitizeBlockHtml(html: string): string`
- sanitizer configuration object

### Recommended config

```ts
import sanitizeHtml from "sanitize-html";

export const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "div", "section", "article", "ul", "ol", "li", "p",
    "h1", "h2", "h3", "h4",
    "strong", "em", "b", "i", "small",
    "code", "pre", "blockquote",
    "a", "span", "hr", "br",
    "table", "thead", "tbody", "tr", "th", "td"
  ],
  allowedAttributes: {
    "*": ["class"],
    a: ["href", "target", "rel"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"]
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowProtocolRelative: false,
  disallowedTagsMode: "discard"
};
```

Keep the sanitizer config and system prompt allow-list in sync.

---

## 12. Scheduler Design

Use a **single periodic tick** instead of one timer per block.

### Recommended constants

```ts
const SCHEDULER_TICK_MS = 10_000;
const MAX_GLOBAL_CONCURRENCY = 2;
const RUN_TIMEOUT_MS = 60_000;
```

### In-memory state

```ts
const runningBlockIds = new Set<number>();
let activeRuns = 0;
```

### Startup logic

1. initialize DB
2. reset stale `running` rows from previous crash/process stop
3. start scheduler tick

If a block is persisted as `running` on startup, convert it to `error` with a message like:

`Previous run did not finish because the server stopped.`

Then set `next_run_at = now`.

### Tick pseudocode

```ts
onTick():
  if activeRuns >= MAX_GLOBAL_CONCURRENCY:
    return

  now = nowIso()
  capacity = MAX_GLOBAL_CONCURRENCY - activeRuns
  dueBlocks = findDueBlocks(now, capacity)

  for each block in dueBlocks:
    if runningBlockIds.has(block.id):
      continue
    startRun(block)
```

### `startRun(block)` pseudocode

```ts
async function startRun(block) {
  runningBlockIds.add(block.id)
  activeRuns += 1

  try {
    markBlockRunning(block.id, nowIso())
    broadcastSse("block-updated", { blockId: block.id, status: "running" })

    const result = await runClaudeTask(block.prompt)
    const finishedAt = nowIso()
    const nextRunAt = addInterval(finishedAt, block.interval_value, block.interval_unit)

    if (result.ok) {
      markBlockSuccess(block.id, result.html, finishedAt, nextRunAt)
      broadcastSse("block-updated", { blockId: block.id, status: "success" })
    } else {
      markBlockError(block.id, result.error, finishedAt, nextRunAt)
      broadcastSse("block-updated", { blockId: block.id, status: "error" })
    }
  } catch (err) {
    const finishedAt = nowIso()
    const nextRunAt = addInterval(finishedAt, block.interval_value, block.interval_unit)
    markBlockError(block.id, toUserMessage(err), finishedAt, nextRunAt)
    broadcastSse("block-updated", { blockId: block.id, status: "error" })
  } finally {
    runningBlockIds.delete(block.id)
    activeRuns -= 1
  }
}
```

This satisfies the “single catch-up run only” requirement automatically.

---

## 13. API Contract

### `GET /api/blocks`

Returns all blocks in creation order.

### `GET /api/blocks/:id`

Returns one block.

### `GET /api/events`

Long-lived SSE endpoint for change notifications.

Behavior:

- client opens one `EventSource` connection on page load
- server keeps the connection open
- server emits events when a block changes state or content
- client uses the event payload to refetch one block or the full list

Recommended event payload:

```json
{
  "type": "block-updated",
  "blockId": 12,
  "status": "success"
}
```

Optional fallback:

```json
{
  "type": "blocks-invalidated"
}
```

### `POST /api/blocks`

Request:

```json
{
  "prompt": "...",
  "intervalValue": 15,
  "intervalUnit": "minutes"
}
```

Behavior:

- create row
- set `next_run_at = now`
- return created block
- either trigger immediate run if capacity exists, or leave it due immediately for scheduler pickup

### `POST /api/blocks/:id/refresh`

Behavior:

- if not running, set `next_run_at = now`
- optionally trigger immediate run inline/asynchronously
- return current block state

### `POST /api/blocks/:id/update`

Request:

```json
{
  "prompt": "...",
  "intervalValue": 1,
  "intervalUnit": "hours"
}
```

Behavior:

- update fields
- set `next_run_at = now`
- return updated block

### `POST /api/blocks/:id/delete`

Behavior:

- delete row
- return success boolean
- broadcast invalidation or delete event if needed

### Response conventions

```json
{ "ok": true, "block": { ... } }
```

or

```json
{ "ok": false, "error": "..." }
```

---

## 14. Validation Rules

Validation can be implemented manually or with `zod`.

### Create/update validation

- prompt: non-empty trimmed string
- prompt max length: simple cap, e.g. `8000`
- intervalValue: integer > 0
- intervalUnit: one of `minutes | hours | days`

Recommended max interval value: `365`.

---

## 15. Server Implementation Plan

`server.ts` should do five things only:

1. initialize DB and scheduler
2. serve the frontend shell
3. serve API routes
4. expose the SSE endpoint
5. return JSON responses

### Suggested structure

```ts
initDb();
resetStaleRunningBlocksOnStartup();
startScheduler();

Bun.serve({
  port: 3000,
  fetch(req) {
    return routeRequest(req);
  }
});
```

Do not add a framework unless Bun routing becomes noticeably painful.

---

## 16. Frontend Implementation Plan

Use one small React app.

### Frontend responsibilities

- load blocks
- render create form
- render feed
- handle create/update/delete/refresh
- subscribe to SSE updates
- rerender changed blocks when notified
- render sanitized HTML with `dangerouslySetInnerHTML`

Only render HTML that has already been sanitized on the server.

### Suggested component breakdown

#### `App`

- fetches block list on mount
- holds block array state
- opens one `EventSource` connection
- reacts to server notifications by refetching updated data
- passes handlers down

#### `CreateBlockForm`

- local controlled fields
- submit to create endpoint
- reset after success

#### `Feed`

- maps blocks to cards in creation order

#### `BlockCard`

- renders schedule/meta/actions
- renders state-specific body

#### `BlockBody`

- success: HTML fragment
- running: loading state
- error: error panel

#### `ErrorPanel`

- clear error styling and message presentation

---

## 17. SSE Update Strategy

There is no need for websockets, and polling should not be the primary mechanism.

### Recommended approach

- open one global `EventSource` connection to `GET /api/events`
- when the server changes a block, emit an SSE notification
- client receives the event and refetches either:
  - the single block via `GET /api/blocks/:id`, or
  - the full block list for maximum simplicity

### Recommendation

Use SSE for notifications and keep normal JSON endpoints for all reads and mutations.

This split is ideal for the PoC:

- **SSE = something changed**
- **JSON = fetch actual state**

### Reconnection behavior

`EventSource` handles reconnection automatically.

Open the stream once on mount, close it on unmount, and tolerate temporary disconnects.

---

## 18. UI Implementation Notes

### Layout

- centered column
- create form at top
- cards below
- subtle background

### Tailwind usage

Keep classes inline and straightforward.

Recommended visual treatment:

- page container: `min-h-screen bg-zinc-50`
- inner column: `mx-auto max-w-4xl px-4 py-10`
- card: `rounded-2xl border border-zinc-200 bg-white shadow-sm`

### Error card

Use a distinct but restrained style.

### Empty state

`No blocks yet. Add your first scheduled block above.`

---

## 19. State Mutation Rules

For the PoC, favor simple refetch-after-mutation over aggressive optimistic updates.

### On create

- append new block to state or refetch full list
- block will move to `running` quickly via SSE event if immediate execution starts

### On refresh

- call refresh endpoint
- rely on SSE for running/success/error transitions

### On update

- replace block with API response or refetch list
- block likely transitions to `running` quickly

### On delete

- remove block from state immediately after successful response or refetch list

---

## 20. Error Message Strategy

User-facing examples:

- `Claude CLI is not installed or not available in PATH.`
- `Task timed out after 60 seconds.`
- `Task returned no HTML output.`
- `Task returned invalid or unsafe HTML.`
- `The block could not be saved.`

Internal logs may include stderr and stack traces, but do not show those raw details in the UI.

---

## 21. Development Logging

Suggested log events:

- `db:init`
- `scheduler:start`
- `scheduler:tick`
- `block:create`
- `block:update`
- `block:delete`
- `run:start`
- `run:success`
- `run:error`
- `run:timeout`
- `sse:connect`
- `sse:disconnect`
- `sse:broadcast`

---

## 22. Implementation Sequence

### Step 1: Bootstrap app shell

- initialize Bun project
- add dependencies
- configure Bun HTML/static frontend
- wire Tailwind plugin
- serve a blank page

### Step 2: Add SQLite setup

- create schema
- create DB helpers
- test create/list/delete manually

### Step 3: Build basic API

- `GET /api/blocks`
- `GET /api/blocks/:id`
- `POST /api/blocks`
- `POST /api/blocks/:id/refresh`
- `POST /api/blocks/:id/update`
- `POST /api/blocks/:id/delete`

### Step 4: Build frontend CRUD UI

- render block list
- create form
- delete button
- edit flow

### Step 5: Add scheduler skeleton

- periodic tick
- due block selection
- mark running
- temporary fake runner that returns static HTML

### Step 6: Add SSE endpoint and client subscription

- implement `GET /api/events`
- connect `EventSource` on the client
- broadcast on block changes

### Step 7: Add full Claude runner

- subprocess invocation
- timeout
- delimiter parsing
- sanitizer
- success/error persistence

### Step 8: Startup recovery

- stale `running` reset
- due-at-start behavior

### Step 9: Final polish

- improve spacing
- nicer badges
- clearer error panel
- verify create/edit/delete/refresh flows

---

## 23. Testing Checklist

### CRUD

- create valid block
- reject invalid interval
- reject empty prompt
- edit block
- delete block

### Scheduler

- block runs immediately after create
- block reruns after interval
- only one run per block at a time
- multiple missed intervals collapse to one run

### Runner

- valid HTML succeeds
- empty HTML fails
- malformed delimiter output fails
- disallowed tags removed
- fully unsafe output fails
- timeout handled correctly

### SSE

- client connects successfully
- server emits on running/success/error
- client refetches updated block
- reconnect after server restart works
- disconnected clients are removed cleanly

### Restart behavior

- restart while block idle
- restart while block due
- restart while block persisted as running

---

## 24. Future-Proofing Without Extra Complexity

Two decisions reduce future pain:

### Keep runner isolated

All Claude-specific process logic should live in `runner.ts`.

### Keep API shapes clean

Use reasonably stable JSON response shapes now.

---

## 25. Minimal Starter Pseudocode

### `scheduler.ts`

```ts
export function startScheduler() {
  setInterval(async () => {
    await tickScheduler();
  }, 10_000);
}
```

### `sse.ts`

```ts
export function broadcastSse(event: string, payload: unknown) {
  // write `event:` and `data:` frames to all connected clients
}
```

### `runner.ts`

```ts
export async function runBlockPrompt(prompt: string): Promise<RunResult> {
  // build request payload
  // spawn claude cli
  // read stdout/stderr
  // parse delimiters
  // sanitize html
  // return typed result
}
```

### `server.ts`

```ts
Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/api/blocks") {
      return Response.json({ blocks: listBlocks() });
    }

    if (req.method === "GET" && url.pathname === "/api/events") {
      return createSseResponse();
    }

    return serveFrontend(url.pathname);
  }
});
```

### `App.tsx`

```tsx
export function App() {
  const [blocks, setBlocks] = useState<Block[]>([]);

  async function refetchBlocks() {
    const res = await fetch("/api/blocks");
    const data = await res.json();
    setBlocks(data.blocks);
  }

  async function refetchBlock(id: number) {
    const res = await fetch(`/api/blocks/${id}`);
    const data = await res.json();
    setBlocks((prev) => prev.map((b) => (b.id === id ? data.block : b)));
  }

  useEffect(() => {
    void refetchBlocks();
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/events");

    es.addEventListener("block-updated", (event) => {
      const payload = JSON.parse((event as MessageEvent).data);
      void refetchBlock(payload.blockId);
    });

    es.addEventListener("blocks-invalidated", () => {
      void refetchBlocks();
    });

    return () => es.close();
  }, []);

  return <main>{/* form + feed */}</main>;
}
```

---

## 26. SSE Server Implementation Notes

Bun should expose one long-lived SSE endpoint, for example `GET /api/events`.

### Responsibilities

- keep track of connected clients
- send correctly formatted SSE messages
- remove disconnected clients cleanly
- broadcast block change notifications from scheduler and mutation handlers

### Response requirements

The endpoint should return a streaming response with SSE headers such as:

- `Content-Type: text/event-stream`
- `Cache-Control: no-cache`
- `Connection: keep-alive`

### Event format

Use standard SSE framing:

```text
event: block-updated
data: {"blockId":12,"status":"success"}

```

Each event must end with a blank line.

### Keepalive

Send a lightweight keepalive comment every 20 seconds:

```text
: keepalive

```

This helps some environments keep the connection open.

### Client registry

Keep the implementation tiny with a small in-memory registry of connected streams or writers.

### Broadcast helper

Add one helper like:

```ts
broadcastSse("block-updated", {
  blockId: 12,
  status: "success"
});
```

Call it when:

- a block enters `running`
- a block finishes with `success`
- a block finishes with `error`
- a block is deleted
- a block is updated in a way that should immediately refresh the UI

### Failure handling

If writing to one client fails:

- close/remove that client
- continue broadcasting to the others

### Recommendation

Keep SSE payloads small and use them only as invalidation/update notifications. Continue using normal JSON endpoints as the source of truth for actual block data.

---

## 27. Definition of Done

The PoC is done when all of these are true:

- user can create a block with prompt + interval
- block is saved in SQLite
- block runs automatically and immediately after creation
- Claude Code CLI output is parsed, sanitized, and rendered as HTML
- errors are shown clearly instead of normal content
- block reruns on schedule
- sleep/restart/downtime cause only one catch-up run, not many
- SSE notifies the UI about block changes
- user can refresh, edit, and delete blocks
- app remains small, understandable, and dependency-light

That is sufficient for a first working Floudeck proof of concept.

