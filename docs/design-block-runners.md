# Block Runner Types — Design Document

> Draft — research & architecture only, no implementation yet.

## Problem

Blocks currently only support one runner: `claude --print`. We want to support multiple ways of getting data into blocks while keeping the system simple and extensible.

## Runner Types

### 1. `claude-cli` (current)

Spawns `claude --print` via `Bun.spawn()`. Output delimited with `===BEGIN_MARKDOWN===` / `===END_MARKDOWN===`.

**Settings**: model, permissions, timeout, env, cwd, append-system-prompt.

**Streaming** (new): The CLI supports real-time token streaming:
```
claude --print --output-format stream-json --verbose --include-partial-messages
```

Output is NDJSON (one JSON object per line). Key message types:
- `{"type":"system","subtype":"init",...}` — session init
- `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}}` — each token as it arrives
- `{"type":"stream_event","event":{"type":"content_block_stop",...}}` — block complete
- `{"type":"stream_event","event":{"type":"message_delta","delta":{"stop_reason":"end_turn",...}}}` — turn complete
- `{"type":"result","subtype":"success","result":"...","duration_ms":...,"total_cost_usd":...}}` — final result with cost/usage

Without `--include-partial-messages`, you only get complete assistant messages (no token deltas). With it, you get full token-level streaming.

**Impact on current runner**: When streaming is enabled, we no longer need the `===BEGIN_MARKDOWN===` delimiters — the `result` message contains the final output. We'd still use `--append-system-prompt` for block context, but output extraction changes from delimiter parsing to collecting `text_delta` events.

### 2. `claude-sdk` (Claude Agent SDK)

Uses `@anthropic-ai/claude-agent-sdk` — the official SDK that gives programmatic access to the same agent loop that powers Claude Code.

**Package**: `npm install @anthropic-ai/claude-agent-sdk`

**Auth**: Requires `ANTHROPIC_API_KEY` env var (or Bedrock/Vertex/Azure credentials). Does **not** use Claude Code's managed login auth.

**Core API**: `query()` returns an async generator that streams `SDKMessage` objects:

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const q = query({
  prompt: blockPrompt,
  // OR: prompt: asyncGeneratorForMultiTurn(),
  options: {
    model: "sonnet",
    cwd: config.cwd,
    env: config.env,
    systemPrompt: { type: "preset", preset: "claude_code", append: floudeckSystemPrompt },

    // Tools & permissions
    allowedTools: ["Read", "Edit", "Bash", "Glob", "Grep"],
    disallowedTools: ["WebFetch"],       // always deny, even in bypassPermissions
    permissionMode: "default",            // "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk"
    canUseTool: handlePermissionRequest,  // callback for interactive approval

    // Streaming
    includePartialMessages: true,         // token-level streaming events

    // Limits
    maxTurns: 20,
    maxBudgetUsd: 1.0,
    effort: "high",                       // "low" | "medium" | "high" | "max"

    // Lifecycle
    abortController,                      // cancellation
    hooks: {
      PreToolUse: [{ matcher: "Bash", hooks: [auditBashCommands] }],
      PostToolUse: [{ matcher: "Edit|Write", hooks: [logFileChanges] }],
    },

    // Sessions
    persistSession: false,                // don't save to disk (we manage our own state)
    // resume: previousSessionId,         // resume a prior session

    // MCP servers (optional)
    mcpServers: {
      playwright: { command: "npx", args: ["@playwright/mcp@latest"] },
    },
  },
});

for await (const message of q) {
  // SDKMessage types: system, assistant, user, result, partial, status, hook_started, etc.
  if (message.type === "result") {
    // message.result contains the final text output
  }
}
```

**`Query` object methods** (beyond async iteration):
- `q.interrupt()` — interrupt mid-task
- `q.setPermissionMode(mode)` — change permissions dynamically
- `q.setModel(model)` — change model mid-session
- `q.streamInput(asyncIterable)` — send follow-up messages for multi-turn
- `q.close()` — terminate and clean up

**Permission handling** via `canUseTool` callback:

```ts
async function handlePermissionRequest(
  toolName: string,
  input: Record<string, unknown>,
  options: { signal: AbortSignal; toolUseID: string; agentID?: string }
): Promise<PermissionResult> {
  // Forward to client via SSE, wait for response
  // input contains tool-specific params:
  //   Bash: { command, description, timeout }
  //   Write: { file_path, content }
  //   Edit: { file_path, old_string, new_string }

  return { behavior: "allow", updatedInput: input };
  // OR: { behavior: "deny", message: "User rejected" }
  // Can also modify input before allowing (sandboxing, path rewriting, etc.)
}
```

**Built-in tools available**: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Agent (subagents), AskUserQuestion.

**Subagents**: Can define specialized sub-agents programmatically:
```ts
agents: {
  "code-reviewer": {
    description: "Expert code reviewer",
    prompt: "Analyze code quality and suggest improvements.",
    tools: ["Read", "Glob", "Grep"],
    model: "haiku",  // cheaper model for sub-tasks
  }
}
```

**Key differences from CLI runner**:
- No process spawning — runs in-process via the SDK
- Native typed streaming — no NDJSON parsing
- `AbortController` for cancellation — no `proc.kill()`
- `canUseTool` callback for interactive permission approval
- Hooks for pre/post tool use, audit logging, input sanitization
- Session management (resume, fork)
- Subagent orchestration
- MCP server integration (stdio, SSE, HTTP, or in-process SDK servers)

### 3. `shell`

Runs an arbitrary shell command. The command is typically generated by Claude during interactive block creation (see below), but can also be hand-written.

**Settings**: env, cwd, timeout.

No model, no permissions — it's just a process. Output is captured stdout (treated as markdown). Exit code determines success/error.

**Examples**:
- `curl -s https://api.example.com/status | jq .`
- `python3 fetch_report.py`
- `bun run scripts/daily-summary.ts`

**Streaming**: Read stdout line-by-line as it's produced. Same SSE mechanism as claude-cli streaming.

### 4. `external-cli`

Runs other AI CLI tools (e.g., `aider`, `goose`, `codex`). Structurally identical to `shell` but with a distinct type so the UI can show AI-specific affordances (model badge, token counts if available).

**Settings**: command (the CLI binary + args template), env, cwd, timeout.

The `command` field uses `{prompt}` as a placeholder:
```
aider --message "{prompt}" --no-auto-commits
```

**Streaming**: Same as shell — line-by-line stdout.

### 5. `api`

Calls an HTTP endpoint or SDK. For fetching data from external services (weather APIs, monitoring dashboards, RSS feeds, etc.).

**Settings**: url, method, headers, body template, timeout, env (for secrets via `$__FLOUDECK_INHERIT__`).

Output: Response body treated as markdown (or transformed via a jq-like expression).

This is the simplest runner — no AI, no process spawning for simple cases. Thin wrapper around `fetch()`.

**Note**: For complex API interactions, users would use `shell` with a script instead.

---

## Architecture

### Runner interface

The current `RunBlockFn` signature stays, but we add streaming and permission callbacks:

```ts
type RunBlockFn = (
  prompt: string,
  config: ResolvedRunnerConfig,
  callbacks?: RunCallbacks,
) => Promise<RunResult>;

type RunCallbacks = {
  onPartialOutput?: (text: string) => void;
  onPermissionRequest?: (req: PermissionRequest) => Promise<PermissionResponse>;
  onToolUse?: (event: ToolUseEvent) => void;
};

type PermissionRequest = {
  id: string;         // unique ID for this request (maps to SDK's toolUseID)
  tool: string;       // "Bash", "Write", "Edit", etc.
  input: Record<string, unknown>;
  description?: string;
};

type PermissionResponse =
  | { behavior: "allow"; updatedInput?: Record<string, unknown> }
  | { behavior: "deny"; message: string };

type ToolUseEvent = {
  tool: string;
  input: Record<string, unknown>;
  phase: "pre" | "post";
  result?: unknown;  // only for "post"
};
```

### Runner registry

Each runner type is a factory function:

```ts
type RunnerFactory = (systemPrompt: string) => RunBlockFn;

const runners: Record<RunnerType, RunnerFactory> = {
  "claude-cli": createClaudeCliRunner,
  "claude-sdk": createClaudeSdkRunner,
  "shell": createShellRunner,
  "external-cli": createExternalCliRunner,
  "api": createApiRunner,
};
```

The scheduler resolves the runner type from block config and dispatches accordingly.

### Config changes

```ts
type RunnerType = "claude-cli" | "claude-sdk" | "shell" | "external-cli" | "api";

// Per-runner-type settings (discriminated union)
type RunnerTypeConfig =
  | { type: "claude-cli"; model?: string; permissions?: PermissionMode; timeout?: number; env?: Record<string, string>; cwd?: string }
  | { type: "claude-sdk"; model?: string; permissionMode?: SdkPermissionMode; timeout?: number; env?: Record<string, string>; cwd?: string; allowedTools?: string[]; disallowedTools?: string[]; maxTurns?: number; maxBudgetUsd?: number; effort?: string; mcpServers?: Record<string, unknown> }
  | { type: "shell"; command?: string; timeout?: number; env?: Record<string, string>; cwd?: string }
  | { type: "external-cli"; command: string; timeout?: number; env?: Record<string, string>; cwd?: string }
  | { type: "api"; url: string; method?: string; headers?: Record<string, string>; body?: string; timeout?: number; env?: Record<string, string> };

type SdkPermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan" | "dontAsk";
```

The existing `runner_config` JSON column absorbs the `type` field. Blocks without a `type` default to `"claude-cli"` (backward compatible).

### DB changes

Minimal — the `runner_config` JSON column already stores arbitrary config:

- `runner_config.type` — discriminant field (default: `"claude-cli"`)
- No schema migration needed (it's inside JSON)

Partial output is **in-memory only** (a `Map<blockId, string>` in the scheduler). The DB only stores final output. This avoids write amplification from streaming.

---

## Streaming Architecture

### Backend

1. Runner produces incremental text via `onPartialOutput` callback
2. Scheduler holds partial output in an in-memory `Map<number, string>` (blockId → accumulated text)
3. SSE broadcasts `block-partial` events: `{ blockId, text }` (the delta, not full output)
4. New SSE endpoint `GET /api/blocks/:id/partial` returns current accumulated partial output (for late-joining clients)
5. On completion, `output_markdown` is set to final output, partial map entry is cleared

### Client

1. `useSse` hook listens for `block-partial` events
2. Appends chunks to a local buffer per block
3. Renders partial markdown in `BlockBody` (same `marked` renderer)
4. On `block-updated` with status=success/error, switches to final `output_markdown` from API

### Backpressure

- SSE chunks are small (just the delta text)
- For claude-cli: debounce NDJSON processing (~100ms batches)
- Client batches renders with `requestAnimationFrame`

### Claude CLI streaming implementation

```ts
// Switch from --print to streaming flags
const args = ["claude", "--print",
  "--output-format", "stream-json",
  "--verbose",
  "--include-partial-messages",
  "--model", config.model,
  "--append-system-prompt", systemPrompt,
  "--", prompt,
];

const proc = Bun.spawn(args, { cwd, stdout: "pipe", stderr: "pipe", env });

// Read stdout as a stream of NDJSON lines
const reader = proc.stdout.getReader();
const decoder = new TextDecoder();
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });

  const lines = buffer.split("\n");
  buffer = lines.pop() ?? "";

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.type === "stream_event" && msg.event?.type === "content_block_delta") {
        callbacks?.onPartialOutput?.(msg.event.delta.text);
      }
      if (msg.type === "result" && msg.subtype === "success") {
        finalOutput = msg.result;
      }
    } catch { /* skip malformed lines */ }
  }
}
```

### Claude Agent SDK streaming implementation

```ts
import { query } from "@anthropic-ai/claude-agent-sdk";

const abortController = new AbortController();

const q = query({
  prompt: blockPrompt,
  options: {
    model: config.model,
    cwd: config.cwd,
    env: config.env,
    systemPrompt: { type: "preset", preset: "claude_code", append: systemPrompt },
    allowedTools: config.allowedTools,
    permissionMode: config.permissionMode,
    includePartialMessages: true,
    abortController,
    persistSession: false,
    canUseTool: async (toolName, input, opts) => {
      // Forward to client via callbacks
      if (callbacks?.onPermissionRequest) {
        return callbacks.onPermissionRequest({
          id: opts.toolUseID,
          tool: toolName,
          input,
        });
      }
      // No handler = deny by default (safe)
      return { behavior: "deny", message: "No permission handler configured" };
    },
    hooks: {
      PostToolUse: [{
        hooks: [async (input) => {
          callbacks?.onToolUse?.({
            tool: input.tool_name,
            input: input.tool_input,
            phase: "post",
            result: input.tool_result,
          });
          return {};
        }],
      }],
    },
  },
});

let finalResult = "";
for await (const message of q) {
  if (message.type === "assistant" && message.message?.content) {
    // Partial or complete assistant messages
    for (const block of message.message.content) {
      if (block.type === "text") {
        callbacks?.onPartialOutput?.(block.text);
      }
    }
  }
  if (message.type === "result") {
    finalResult = message.result;
  }
}
```

---

## Interactive Block Creation / Editing

This is critical for `claude-sdk` (permissions) and useful for all runner types (prompt refinement).

### Concept

"Try mode" — a panel where you compose a block and iterate on it before saving:

1. User picks runner type, enters prompt/config
2. Clicks "Try" — runs the block once with output streaming to the panel
3. User sees output in real-time, can adjust prompt and retry
4. For `claude-sdk`: permission requests appear as inline confirmations in the panel
5. Once satisfied, user clicks "Save as block" — creates the scheduled block with the finalized config

### UI Flow

```
┌─────────────────────────────────────────┐
│  New Block                    [Try ▶]   │
├─────────────────────────────────────────┤
│ Runner: [claude-cli ▼]                  │
│                                         │
│ Prompt:                                 │
│ ┌─────────────────────────────────────┐ │
│ │ Summarize today's top HN stories   │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ▸ Advanced settings                     │
│                                         │
│ ─── Output ─────────────────────────── │
│ # Top Hacker News Stories              │
│ 1. Show HN: Floudeck - scheduled...   │
│ 2. ...                                 │
│ *(streaming...)*                       │
│                                         │
│          [Try again]  [Save as block]   │
└─────────────────────────────────────────┘
```

For `claude-sdk` with permissions:

```
┌─────────────────────────────────────────┐
│ ─── Output ─────────────────────────── │
│ Analyzing your request...              │
│                                         │
│ ┌─ Permission Request ───────────────┐ │
│ │ Bash: npm install express          │ │
│ │ "Install express web framework"    │ │
│ │                                     │ │
│ │   [Allow]  [Deny]                  │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ ▸ Tool activity (3 calls)              │
│   Read package.json                    │
│   Bash: npm install express            │
│   Write src/server.ts                  │
│                                         │
│ Created server.ts with Express setup.. │
│                                         │
│          [Try again]  [Save as block]   │
└─────────────────────────────────────────┘
```

### How it works

**Server side:**

1. `POST /api/blocks/try` — starts a try-run, returns a `tryRunId`
2. Server spawns a temporary runner with streaming + permission callbacks
3. Output streams via SSE using `try-partial` events tagged with `tryRunId`
4. Permission requests are sent as SSE `try-permission` events
5. `POST /api/blocks/try/:id/respond` — client sends permission decision back
6. On completion, `try-complete` SSE event with final output
7. Try-run state is in-memory only, cleaned up on disconnect or timeout

**Client side:**

1. BlockForm gets a "Try" button alongside "Save"
2. "Try" opens an output panel below the form
3. `useSse` hook handles `try-*` events for the active tryRunId
4. Permission requests render inline with Allow/Deny buttons
5. Tool activity collapsible shows audit trail
6. "Save as block" sends finalized config to `POST /api/blocks` (existing endpoint)

**Permission flow detail (claude-sdk):**

```
Client                    Server                     SDK
  │                         │                          │
  │ POST /api/blocks/try    │                          │
  │────────────────────────>│  query({ canUseTool })   │
  │                         │─────────────────────────>│
  │                         │                          │
  │  SSE: try-partial       │   onPartialOutput        │
  │<────────────────────────│<─────────────────────────│
  │                         │                          │
  │  SSE: try-permission    │   canUseTool called      │
  │<────────────────────────│<─────────────────────────│
  │                         │                          │
  │ User clicks [Allow]     │                          │
  │ POST /try/:id/respond   │                          │
  │────────────────────────>│  resolve Promise          │
  │                         │─────────────────────────>│
  │                         │                          │
  │  SSE: try-complete      │   result message         │
  │<────────────────────────│<─────────────────────────│
```

The `canUseTool` callback creates a Promise, stores its resolver in a map keyed by `tryRunId + toolUseID`, sends the SSE event, and awaits. When the client POSTs `/respond`, the server resolves the Promise.

### Editing existing blocks

Same "Try" panel, pre-populated with current config. User iterates, then "Save" updates the block. The existing `POST /api/blocks/:id/update` endpoint works as-is.

### Scheduled runs with permissions

For scheduled (non-interactive) runs, the SDK runner has two options:
1. **`permissionMode: "bypassPermissions"`** — auto-approve everything (user configures this explicitly)
2. **`permissionMode: "dontAsk"`** with `allowedTools` — only pre-approved tools work, rest denied silently
3. **`permissionMode: "default"`** — unapproved tools denied (no one to approve during scheduled run)

The UI should guide users: "During scheduled runs, only pre-approved tools will work. Use Try mode to discover which tools your prompt needs, then add them to allowedTools."

### Audit log

Tool use events from SDK hooks are stored per-run in an in-memory structure and included in the final `RunResult`:

```ts
type RunResult =
  | { ok: true; markdown: string; reasoning: string | null; toolLog?: ToolUseEvent[] }
  | { ok: false; error: string; stderr?: string; toolLog?: ToolUseEvent[] };
```

Displayed in an expandable section in the block card:

```
▸ Tool activity (12 calls)
  Read src/index.ts
  Edit src/index.ts
  Bash: npm test → exit 0
  ...
```

For now, tool logs are not persisted in DB (they can be large). Only shown for the latest run. If we want history, a separate `run_history` table would be more appropriate.

---

## Runner-Specific Settings UI

The "Advanced settings" section in BlockForm changes based on runner type:

| Setting | claude-cli | claude-sdk | shell | external-cli | api |
|---------|:---:|:---:|:---:|:---:|:---:|
| model | ✓ | ✓ | | | |
| permissions | ✓ | ✓* | | | |
| timeout | ✓ | ✓ | ✓ | ✓ | ✓ |
| env | ✓ | ✓ | ✓ | ✓ | ✓ |
| cwd | ✓ | ✓ | ✓ | ✓ | |
| command | | | ✓ | ✓ | |
| allowedTools | | ✓ | | | |
| disallowedTools | | ✓ | | | |
| maxTurns | | ✓ | | | |
| maxBudgetUsd | | ✓ | | | |
| effort | | ✓ | | | |
| url | | | | | ✓ |
| method | | | | | ✓ |
| headers | | | | | ✓ |
| body | | | | | ✓ |

*SDK has richer permission modes: `default`, `acceptEdits`, `bypassPermissions`, `plan`, `dontAsk`

### Prompt field behavior

- **claude-cli / claude-sdk**: Prompt is sent to Claude as the user message
- **shell**: Prompt field is the shell command itself (or a description if `command` is in config)
- **external-cli**: Prompt is substituted into the `{prompt}` placeholder in `command`
- **api**: No prompt field — the URL/body template is the "input"

---

## Implementation Phases

### Phase 1: Interactive "Try" mode
The foundation — everything else builds on this.
- Add `/api/blocks/try` endpoint (stateless, in-memory)
- In-memory try-run state management (run process, output buffer, cleanup on disconnect/timeout)
- SSE events: `try-partial`, `try-complete`, `try-error`
- Client-side Try panel in BlockForm (output area below the form)
- "Try" button alongside "Save" in block creation and editing
- Initially works with `claude-cli` runner only (no permissions yet)

### Phase 2: CLI streaming
Streaming output for both Try mode and the main feed.
- Add `--output-format stream-json --verbose --include-partial-messages` to CLI args
- Parse NDJSON stdout line-by-line, extract `text_delta` events
- Add `onPartialOutput` to `RunCallbacks`, pass through scheduler
- In-memory `Map<blockId, string>` for partial output in scheduler
- Add `block-partial` SSE event for feed blocks
- Client renders streaming output in `BlockBody` (feed) and Try panel
- No DB schema changes

### Phase 3: Runner type system
Generalize the runner interface to support multiple types.
- Add `type` discriminant to `RunnerConfig` schema (zod)
- Create runner factory registry
- Update `resolveRunnerConfig` to handle type-specific defaults
- Generalize `buildCliArgs` → per-runner config builders
- Default missing `type` to `"claude-cli"` (backward compat)
- Update BlockForm with runner type selector

### Phase 4: Shell runner
Simple process runner for scripts and commands.
- Implement shell runner (`Bun.spawn` + stdout streaming)
- UI: "Command" label instead of "Prompt", command editor in BlockForm
- Output treated as markdown (no delimiters)

### Phase 5: Claude Agent SDK runner
The main goal — full programmatic control with permissions.
- Add `@anthropic-ai/claude-agent-sdk` dependency
- Implement SDK runner with `query()` async generator
- Permission request/response flow via SSE (Try mode)
- `canUseTool` → SSE → client → POST → resolve Promise
- Hooks for tool activity audit log
- API key management (`$__FLOUDECK_INHERIT__` for `ANTHROPIC_API_KEY`)
- Scheduled run guidance: `dontAsk` + `allowedTools`

### Phase 6: API & external AI tools runners (deferred)
Lower priority — our focus is Claude.
- API runner: `fetch()` wrapper, URL/body templates, response → markdown
- External CLI runner: template substitution (`{prompt}`) + spawn for tools like `aider`, `goose`, `codex`
- Likely postponed until there's concrete demand

---

## Open Questions

1. **API key management for claude-sdk**: The SDK requires `ANTHROPIC_API_KEY` (or Bedrock/Vertex/Azure credentials). Options:
   - Global setting with a dedicated "API Key" field (stored encrypted or env-only)
   - Use `$__FLOUDECK_INHERIT__` in env config to inherit from host
   - Support both: explicit setting + env inherit fallback

   Recommendation: `$__FLOUDECK_INHERIT__` for `ANTHROPIC_API_KEY` in the runner env config. Simple, no new UI needed, and consistent with existing env handling.

2. **Shell security**: Should we sandbox shell runners? They can do anything the user can. Current approach: trust the user (it's a local app), but show a clear warning in the UI when creating shell blocks.

3. **Output format for non-Claude runners**: Shell/API output won't have the `===BEGIN_MARKDOWN===` delimiters. Options:
   - Treat all stdout as markdown (simple, works for most cases)
   - Wrap non-markdown output in a code block automatically (detect heuristically)
   - Allow configuring output format per runner

   Recommendation: Treat as markdown by default. Users can wrap in code fences in their scripts if needed.

4. **Prompt field semantics**: For shell/api runners, the "prompt" concept doesn't map cleanly. Options:
   - Rename to "input" generically
   - Keep "prompt" for AI runners, use "command"/"url" for others
   - Use the prompt field as a description/label, with the actual command in runner config

   Recommendation: Runner type determines the label shown in the UI. The DB column stays `prompt` for simplicity. UI shows "Prompt" for AI runners, "Command" for shell, "URL" for api.

5. **Try mode state**: Where does the try-run state live?
   - Server-side: in-memory map keyed by tryRunId, cleaned up on completion/disconnect/timeout
   - Client holds the accumulated output buffer for rendering

   Recommendation: Server manages the runner process + permission Promise resolvers. Client manages the output buffer + UI state. Stateless after completion.

6. **SDK runner in scheduled mode**: When a block runs on schedule with `claude-sdk`, there's no user to approve permissions. The `dontAsk` permission mode + `allowedTools` is the cleanest solution — pre-approve what's needed, deny the rest silently. The Try mode helps users discover which tools their prompt needs.

7. **Streaming for existing blocks in feed**: Currently blocks show a spinner until complete. With streaming, we can show live output. Should all blocks stream, or only in Try mode?

   Recommendation: All blocks stream. The feed shows live output for running blocks. This is strictly better UX with minimal additional complexity (the streaming infra is shared).
