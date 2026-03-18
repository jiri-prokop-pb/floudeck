# Floudeck PoC Spec v2

## Goal

Build the simplest possible proof of concept for **Floudeck**: a linear feed of scheduled blocks that periodically run a prompt through Claude Code CLI and render the result as GFM markdown.

The PoC should optimize for:

- minimal implementation complexity
- reliability over features
- clean and pleasant UI
- easy local development
- using **Bun-native** pieces where practical, especially **SQLite**

This version is intentionally narrow. It is not a generic automation platform yet. It is a small local web app that proves the core loop:

**scheduled prompt → CLI task execution → markdown output → feed update**

---

## Product Shape

The application is a single Bun app that:

1. serves a web UI
2. persists block definitions in SQLite
3. schedules block executions in the Bun server process
4. spawns Claude Code CLI for each execution
5. stores only the latest output per block
6. renders a top-to-bottom feed of blocks
7. pushes block update notifications to the client over SSE

The feed is ordered by **creation time**, not by latest update time. That keeps the UI mentally stable.

Each block represents one recurring task. A block has only:

- a prompt
- a repeat interval value
- a repeat interval unit (`minutes`, `hours`, `days`)
- current execution state
- latest rendered markdown or latest error

No block history, no exceptions, no advanced schedules, no actions, no connectors, no user accounts.

---

## Core Constraints

### Included

- add block
- list blocks in feed
- edit block
- delete block
- manual refresh for a block
- automatic scheduled execution
- one latest markdown result per block
- visible error state instead of normal block content
- SSE notifications when a block changes
- catch-up behavior after sleep/wake or downtime: **run once only** if overdue
- per-block and global runner configuration (model, cwd, timeout, permissions, env vars)

### Excluded

- run history
- cron syntax
- multiple users
- authentication
- webhooks
- block actions
- arbitrary JS from task output
- streaming task output into the UI
- retries
- concurrency controls beyond per-block non-overlap and a small global cap
- drag-and-drop ordering
- folders/tags
- external data sources beyond what the prompt itself can instruct Claude Code to do

---

## High-Level Architecture

### 1. Bun server

A single Bun process does all backend work:

- serves HTTP routes
- serves the frontend shell and assets
- exposes JSON endpoints for CRUD and refresh
- exposes one SSE endpoint for change notifications
- manages the in-memory scheduler
- executes Claude Code CLI child processes
- reads/writes SQLite

No separate worker process is needed for the PoC.

### 2. SQLite database

SQLite stores the current state of blocks. Only current state is persisted.

No run log table is needed.

### 3. Bun HTML imports + minimal React

Use Bun’s HTML/static bundling approach for the frontend shell and keep React usage minimal.

Practical PoC shape:

- Bun server for backend routes, scheduling, and task execution
- Bun HTML entrypoint for the client page
- minimal React only where it helps with componentized rendering and small DOM updates
- no complex client state management
- no SPA router

This should not be “React app first.” It should be a Bun app first, with a very small React layer.

Likely setup:

- `index.html` as the frontend entrypoint
- one small `app.tsx` React entry for mounting/enhancing the page
- Tailwind via Bun’s plugin
- backend endpoints returning JSON
- SSE for notifications

---

## Data Model

Use one `blocks` table.

```sql
CREATE TABLE blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  prompt TEXT NOT NULL,
  interval_value INTEGER NOT NULL,
  interval_unit TEXT NOT NULL CHECK(interval_unit IN ('minutes', 'hours', 'days')),
  status TEXT NOT NULL DEFAULT 'idle' CHECK(status IN ('idle', 'running', 'success', 'error')),
  output_markdown TEXT,
  error_text TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_run_at TEXT,
  next_run_at TEXT,
  running_started_at TEXT
);
```

Field meanings stay simple:

- `prompt`: full block prompt text
- `interval_value`: positive integer
- `interval_unit`: schedule unit
- `status`: current execution state
- `output_markdown`: latest successful GFM markdown output
- `error_text`: latest error message if last run failed
- `created_at`: creation timestamp
- `updated_at`: any change timestamp
- `last_run_at`: timestamp of most recent finished run
- `next_run_at`: next scheduled execution time
- `running_started_at`: used to expose `running` state and recover from crashes more safely

---

## Schedule Model

Each block repeats at a simple interval:

- every N minutes
- every N hours
- every N days

Examples:

- `5 minutes`
- `1 hour`
- `2 days`

Rules:

- interval value must be a positive integer
- no cron support
- no time-of-day targeting
- no exclusions
- no weekday rules

### Next run calculation

When a block is created:

- `next_run_at = now`

This makes the scheduler pick it up on the next tick (within ~10 seconds) so the result appears quickly.

After a successful or failed run:

- `last_run_at = finish_time`
- `next_run_at = finish_time + interval`

This “schedule from finish time” model is simple and avoids bursty catch-up behavior.

---

## Scheduler Behavior

The Bun server owns the scheduler.

### Startup

On server start:

1. load all blocks from SQLite
2. inspect `next_run_at`
3. for each block:
   - if overdue, run it once soon
   - if not overdue, leave it for its next due time

### Main rule

A block may have **at most one active execution at a time**.

If a block is already running, a scheduled trigger does nothing.

### Sleep/wake and missed intervals

If the machine sleeps and wakes after multiple intervals elapsed:

- do **not** run multiple times
- run **exactly once** when the scheduler notices the block is overdue
- compute the next run from the current run’s finish time

This same rule also covers server downtime and restart.

### Scheduling implementation

Keep this simple:

- use one periodic tick, for example every 10 seconds
- on each tick, select blocks whose `next_run_at <= now` and `status != 'running'`
- attempt to run them

This is simpler and more robust than maintaining many separate timers.

---

## Task Execution

Each block execution spawns a Claude Code CLI process.

### Inputs to the task

The task receives:

- the block prompt
- a fixed system prompt describing the PoC contract

### System prompt responsibilities

The system prompt should clearly instruct Claude Code to:

- output only GFM markdown in the final section
- start with a `# Title` heading as the first line
- not output raw HTML in the markdown section
- use all GFM features (headings, lists, tables, code blocks, links, bold/italic)
- present useful operational content clearly
- separate any reasoning from final markdown with explicit delimiters

### Execution flow

For each run:

1. set block status to `running`
2. clear previous `error_text`
3. emit SSE event that the block changed to `running`
4. spawn Claude Code CLI
5. capture stdout/stderr
6. enforce timeout
7. extract markdown using delimiters
8. on success, store markdown and mark `success`
10. on failure, store readable error text and mark `error`
11. compute and store `next_run_at`
12. emit SSE event that the block changed to `success` or `error`

### Timeout

Use a conservative timeout such as **60 seconds** for the PoC.

If the process exceeds the timeout:

- kill it
- mark block as `error`
- store `Task timed out after 60s`

---

## Markdown Output Rules

The task output is GitHub Flavored Markdown (GFM) for display only.

### Required format

- The first line of the markdown section MUST be a level-1 heading (`# Title`) that describes the content. This heading is extracted as the card title.
- All standard GFM features are allowed: headings, bold/italic/strikethrough, lists, tables, code blocks, links, task lists, blockquotes.
- No raw HTML in the markdown section.

### Safety

Raw HTML in markdown output is stripped client-side by the `marked` renderer's custom `html()` method that returns an empty string. No server-side sanitization is needed.

If the markdown section is missing or empty, treat the run as an error:

- `error_text = "Task returned no markdown output."`

---

## Error Handling

Errors should be visible and explicit.

If a block is in `error` state, show an error card instead of normal HTML output.

The error card should include:

- a clear `Task failed` heading
- the error message
- last attempted run time
- manual refresh button
- edit button

Possible error cases:

- CLI executable missing
- CLI non-zero exit code
- timeout
- empty output
- invalid delimiter output
- SQLite write failure

Prefer short, readable messages over raw stack traces.

Keep raw stderr in server logs, but store a simplified user-facing error in the database.

---

## UI Spec

### Layout

Single page layout:

1. top header
2. block creation form
3. centered feed of existing blocks

### Visual style

- clean, calm, serious
- narrow centered column
- generous spacing
- subtle borders/shadows
- light background
- cards with rounded corners
- typography that feels operational, not playful

Use roughly `max-w-3xl` or `max-w-4xl`.

### Header

Simple top area with:

- app name: **Floudeck**
- short subtitle such as `Your deck of signals and actions`

No navigation needed.

### Create Block Form

Fields:

- `Prompt` textarea
- `Every` number input
- `Unit` select with `minutes`, `hours`, `days`
- submit button

Validation:

- prompt required
- interval value required
- interval value must be integer > 0
- unit required

Behavior after submit:

- create block
- set `next_run_at = now` so the scheduler picks it up on the next tick
- add the block to the feed

### Block Card

Each block card should show:

#### Meta area

- schedule, e.g. `Every 15 minutes`
- created time or last updated time in small muted text

#### Controls

- `Refresh now`
- `Edit`
- `Delete`

#### State display

**Running**

Show:

- running badge/spinner
- a clear running state

**Success**

Render `output_markdown` as HTML (via `marked`) inside the card.

**Error**

Replace content with a clearly styled error panel containing `error_text`.

#### Footer metadata

- last run time
- next run time
- status badge

---

## SSE Update Model

The client should keep **one global SSE connection** open for the page.

### Rules

- client opens `EventSource` to `GET /api/events` on page load
- server emits an event whenever a block changes state or content
- SSE is used **only for notifications**, not for transporting full HTML or full block payloads
- client reacts by refetching either:
  - the single block via `GET /api/blocks/:id`, or
  - the full list via `GET /api/blocks`

### Recommended event payload

```json
{
  "type": "block-updated",
  "blockId": 12,
  "status": "success"
}
```

### Simpler fallback payload

```json
{
  "type": "blocks-invalidated"
}
```

### Why SSE here

SSE fits Floudeck well because updates are naturally one-way:

- scheduler runs happen on the server
- manual refresh changes state on the server
- client only needs to be notified that something changed

This is simpler than websockets and cleaner than polling for this PoC.

---

## Edit Block

Use a simple dedicated edit view or inline form replacement.

Editable fields:

- prompt
- interval value
- interval unit

On save:

- persist changes
- recompute `next_run_at = now`
- trigger immediate rerun so the output matches the new prompt quickly

---

## Delete Block

Simple delete button with small confirmation. Native browser confirm is acceptable.

Deleting a block removes it from SQLite and from the feed.

If it is currently running, best-effort behavior is acceptable:

- delete the row
- if the process finishes later, updating by missing block id should simply do nothing

---

## Server Endpoints

### Pages / assets

- `GET /` → main page
- frontend assets via Bun HTML/static flow

### Read API

- `GET /api/blocks` → full block list
- `GET /api/blocks/:id` → single block
- `GET /api/events` → SSE stream for block change notifications

### Actions / API

- `POST /api/blocks` → create block
- `POST /api/blocks/:id/refresh` → manual refresh
- `POST /api/blocks/:id/update` → save edits
- `POST /api/blocks/:id/delete` → delete block

Prefer small JSON APIs for reads and mutations. Use SSE only to notify the client that something changed.

---

## Rendering Strategy

Prefer a very small React layer mounted from a Bun HTML entrypoint.

Suggested structure:

- `index.html` loads the bundled client entry
- `app.tsx` mounts the page
- React components render:
  - page shell
  - create form
  - feed
  - block card
  - error state

This is still intentionally minimal:

- no router
- no global state library
- no SSR requirement for the PoC
- no websocket layer

### Update flow

Use a single SSE connection for notifications and regular JSON endpoints for data reads/writes.

Typical flow:

1. page loads and fetches blocks
2. client opens `EventSource` to `GET /api/events`
3. server emits an event whenever a block changes state or content
4. client receives the event and refetches either:
   - the single affected block via `GET /api/blocks/:id`, or
   - the full block list for maximum simplicity

This keeps the implementation tiny without introducing websockets and removes the need for polling as the primary mechanism.

---

## Recommended Execution Model

To stay simple and reliable:

- scheduler may start multiple different blocks concurrently if desired
- but each block itself must never overlap

For the PoC, a tiny global concurrency cap is sensible.

Recommended default:

- per-block overlap: forbidden
- global concurrency cap: `2`

Any due blocks beyond the cap simply wait until the next scheduler tick.

---

## Minimal State Machine

Each block moves through these states:

- `idle`
- `running`
- `success`
- `error`

Typical transitions:

- create → `idle` → immediate run → `running`
- running + success → `success`
- running + failure → `error`
- success + scheduled/manual refresh → `running`
- error + manual/scheduled refresh → `running`

---

## Security Notes

Even for a local PoC, apply a few protections:

- Raw HTML in markdown is stripped client-side by the marked renderer
- always escape prompt text when shown in forms
- do not show raw stderr in the browser
- do not build shell commands through string concatenation if avoidable; pass subprocess arguments safely

---

## Logging

Keep logging simple and server-side.

Log events like:

- block created
- block updated
- block deleted
- run started
- run finished
- run failed
- timeout
- SSE client connected/disconnected
- SSE event emitted

Console logging is enough for the PoC.

---

## Suggested File Structure

```text
/src
  server.ts
  db.ts
  scheduler.ts
  runner.ts
  extract.ts
  prompts.ts
  types.ts
  time.ts
  api.ts
  sse.ts
  client/
    index.html
    app.tsx
    main.css
    components/
      App.tsx
      CreateBlockForm.tsx
      Feed.tsx
      BlockCard.tsx
      BlockBody.tsx
      ErrorPanel.tsx
    lib/
      api.ts
      format.ts
```

Keep modules small and obvious.

---

## Bun/SQLite Notes

Use Bun’s native SQLite support directly.

Keep SQL explicit rather than adding an ORM. For a PoC, raw SQL is simpler and easier to control.

Initialize schema at startup if the database file does not exist.

For frontend assets, use Bun’s HTML/static bundling flow and Tailwind plugin.

---

## Claude Code System Prompt Contract

The PoC should define a fixed system prompt used for every task.

The prompt should explain:

- what Floudeck is
- that the model is generating content for one block in an operational feed
- that the user prompt is the full task definition
- that the result must be GFM markdown starting with a `# Title` heading
- that reasoning is allowed, but must stay outside the final output section
- that the final answer must use a strict delimiter format so the server can extract the markdown reliably
- that raw HTML is not allowed in the markdown section

### Recommended output envelope

```text
===BEGIN_REASONING===
(optional reasoning)
===END_REASONING===
===BEGIN_MARKDOWN===
# Title

Content here...
===END_MARKDOWN===
```

The server should ignore everything except the content between `===BEGIN_MARKDOWN===` and `===END_MARKDOWN===`.

If the markdown section is missing or empty, treat the run as an error.

### Draft system prompt

```text
You are generating one content block for Floudeck, a linear operational feed of scheduled blocks.

Your job is to read the user prompt, think through the task, and produce concise, useful GFM markdown that will be rendered inside an existing web application card.

Important constraints:
- The rendered result is for display only.
- The FIRST line of the markdown section MUST be a level-1 heading (# Title).
- Do NOT include raw HTML in the markdown section.
- Use all GFM features: headings, bold/italic, lists, tables, code blocks, links, task lists, blockquotes.
- Keep the result compact, readable, and operationally useful.

Output format is mandatory.

Return exactly this structure:
===BEGIN_REASONING===
Your reasoning here
===END_REASONING===
===BEGIN_MARKDOWN===
# Title That Describes The Content

Your markdown content here
===END_MARKDOWN===

Rules for the markdown section:
- Output valid GFM markdown only.
- Do not wrap it in code fences.
- Do not include any text before or after the markdown inside the section.
- Make sure the content is useful on its own.
```

The reasoning should never be rendered in the UI.

---

## Final Recommendation

Choose these defaults:

- **Bun server with Bun HTML/static frontend flow**
- **minimal React in `app.tsx` only**
- **Tailwind via Bun plugin**
- **SQLite via Bun native API**
- **single `blocks` table**
- **scheduler tick every 10 seconds**
- **interval-only schedules** with minutes/hours/days
- **immediate first run on create/edit**
- **one latest output only**
- **GFM markdown output, rendered client-side with `marked`**
- **raw HTML stripped by custom marked renderer**
- **explicit output delimiters for reasoning vs final markdown**
- **SSE for notifications; no polling as primary mechanism**
- **error card replaces block content**
- **no history, no websockets, no ORM**

This is enough to validate whether the Floudeck concept feels useful in practice while keeping the codebase very small and easy to evolve.

---

## Nice-to-Have Additions Only If They Stay Tiny

Optional only if nearly free:

- duplicate block button
- small `last updated X min ago` label
- empty state text
- lightweight global banner if Claude CLI is unavailable

None of these should complicate the architecture.

