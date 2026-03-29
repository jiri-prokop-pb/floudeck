# Rust Rewrite — Eliminating Bun & JS Backend

## Goal

Replace the entire Bun/JS backend with native Rust inside the Tauri app. The frontend (React + TypeScript) stays. The sidecar process disappears — Tauri **is** the backend.

## Current state

- **Backend**: ~2,100 LOC Bun/TS across 10 modules (db, scheduler, runner, api, sse, config, validate, prompts, paths, extract)
- **Frontend**: ~2,700 LOC React 19 + Tailwind + marked (unchanged by rewrite)
- **Tauri shell**: ~100 LOC Rust, only spawns sidecar + handles window events
- **Tests**: ~2,400 LOC unit tests + Playwright E2E

## What changes

| Layer | Before (Bun) | After (Rust) |
|-------|--------------|--------------|
| HTTP API (14 endpoints) | `Bun.serve()` + custom router | Tauri Commands via `invoke()` |
| Real-time updates (SSE) | `EventSource` + ReadableStream | Tauri Events via `emit()` / `listen()` |
| SQLite | `bun:sqlite` | `rusqlite` (or `sqlx` for async) |
| Process spawning (Claude CLI) | `Bun.spawn()` | `tokio::process::Command` |
| Scheduler (10s tick) | `setInterval` + Promises | `tokio::time::interval` + `tokio::spawn` |
| Config / validation | `zod/mini` | `serde` + custom validators |
| Path resolution | `node:path` + `node:fs` | `std::path` + `std::fs` + `dirs` crate |
| Build | `bun build --compile` + `Bun.build()` | `cargo build` (server is Tauri itself) |
| Sidecar binary | Yes (floudeck-server) | **Gone** — no external process |

### Frontend changes (mechanical)

Only two files change significantly:

- **`src/client/lib/api.ts`** — `fetch("/api/...")` → `invoke("command_name", { ... })`
- **`src/client/hooks/useSse.ts`** — `EventSource` → Tauri `listen("event_name", callback)`

All React components, hooks, routing, markdown rendering, drag-and-drop — unchanged.

## Rust crate ecosystem

| Need | Crate | Notes |
|------|-------|-------|
| Async runtime | `tokio` | Already pulled in by Tauri |
| SQLite | `rusqlite` | Simpler; `sqlx` if compile-time checked queries wanted |
| JSON | `serde` + `serde_json` | Already in Cargo.toml |
| CLI args | `clap` | Only if keeping standalone server mode |
| UUID | `uuid` v4 | |
| Timestamps | `chrono` | ISO 8601 UTC |
| Regex | `regex` | For markdown delimiter extraction |
| Home dir | `dirs` | `dirs::home_dir()` |
| Claude CLI lookup | `which` | Replicates current `which` + fallback logic |

## Architecture in Rust

### State management

```rust
struct AppState {
    db: Mutex<Connection>,       // rusqlite
    scheduler: Mutex<Scheduler>, // tracks running blocks, concurrency cap
}

// Registered as Tauri managed state
app.manage(AppState { ... });
```

### Commands (replace REST API)

```rust
#[tauri::command]
async fn list_blocks(state: State<'_, AppState>) -> Result<Vec<Block>, String> {
    let db = state.db.lock().unwrap();
    Ok(db::list_blocks(&db))
}

#[tauri::command]
async fn create_block(state: State<'_, AppState>, input: CreateBlockInput) -> Result<Block, String> {
    let db = state.db.lock().unwrap();
    db::create_block(&db, &input).map_err(|e| e.to_string())
}
```

### Events (replace SSE)

```rust
// From scheduler tick or runner completion:
app_handle.emit("block:status", json!({ "blockId": id, "status": "running" }))?;
app_handle.emit("block:output", json!({ "blockId": id }))?;
```

```typescript
// Frontend:
import { listen } from "@tauri-apps/api/event";
listen("block:status", (e) => { /* refetch block */ });
```

### Scheduler

```rust
// Spawned as a tokio task during Tauri setup:
tokio::spawn(async move {
    let mut interval = tokio::time::interval(Duration::from_secs(10));
    loop {
        interval.tick().await;
        scheduler::tick(&app_handle, &state).await;
    }
});
```

### Runner (Claude CLI)

```rust
use tokio::process::Command;

let mut child = Command::new(&claude_path)
    .args(&cli_args)
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .envs(&resolved_env)
    .current_dir(&cwd)
    .spawn()?;

// Timeout via tokio::time::timeout
let result = tokio::time::timeout(
    Duration::from_secs(timeout),
    child.wait_with_output()
).await;
```

## What gets simpler

1. **No sidecar** — one process instead of two; no port negotiation, no stdout parsing
2. **No Bun runtime** — no Node/Bun dependency at all; single native binary
3. **No HTTP overhead** — IPC is faster than localhost HTTP for every API call
4. **No SSE complexity** — Tauri events are fire-and-forget, no stream management or keepalive
5. **Simpler build** — `cargo tauri build` does everything; no two-phase JS bundling for server
6. **Smaller bundle** — no embedded Bun binary (~50MB savings)
7. **Better error handling** — Rust's `Result` type vs JS try/catch
8. **Thread-safe concurrency** — `Mutex`/`Arc` instead of hoping JS event loop cooperates

## What gets harder

1. **Development velocity** — Rust compile times (~15-30s incremental); Bun hot-reloads instantly
2. **String manipulation** — more verbose than JS for prompt building, markdown extraction
3. **JSON flexibility** — `serde` is stricter than JS; dynamic JSON shapes need `serde_json::Value`
4. **Testing DI** — Rust uses traits + generics instead of function factories; different patterns
5. **Learning curve** — ownership, lifetimes, async Rust if unfamiliar
6. **Frontend dev workflow** — need Tauri dev mode running for `invoke()` to work (can't just `bun run dev`)

## Migration phases

### Phase 1: Core data layer (~3 days)
- Set up `rusqlite` with same schema (tables, migrations, WAL mode)
- Port all `db.ts` query functions
- Port `types.ts` as Rust structs with `serde::Serialize/Deserialize`
- Port `validate.ts` as `TryFrom` / custom validation
- Unit tests with `:memory:` SQLite

### Phase 2: Tauri Commands (~3-4 days)
- Replace all 14 REST endpoints with `#[tauri::command]` functions
- Register commands in Tauri builder
- Update `src/client/lib/api.ts` to use `invoke()`
- Port config resolution (`config.ts`) and path logic (`paths.ts`)

### Phase 3: Events + Scheduler (~3 days)
- Replace SSE broadcaster with Tauri `emit()`
- Update `useSse.ts` to use Tauri `listen()`
- Port scheduler tick logic with `tokio::time::interval`
- Port concurrency cap + running block tracking

### Phase 4: Runner (~2 days)
- Port `runner.ts` (process spawning, stdout capture, timeout)
- Port `extract.ts` (regex delimiter extraction)
- Port `prompts.ts` (system prompt templates)

### Phase 5: Cleanup + Testing (~3-4 days)
- Remove all Bun backend code (`src/*.ts` except client/)
- Remove `scripts/build.ts`, sidecar config from `tauri.conf.json`
- Remove `bun build --compile` from build pipeline
- Port unit tests to Rust `#[test]`
- Verify Playwright E2E tests pass against Tauri dev mode
- Update CLAUDE.md, README.md, SPEC.md

### Total estimate: ~2-3 weeks

## Decision: when to do it

This is a **post-PoC rewrite** — do it once the Bun prototype is feature-complete and stable. The Bun version serves as the living spec; the Rust version is a clean rewrite with known requirements.

Prerequisites before starting:
- All TODO.md items above "Post-PoC" are done (or deliberately deferred)
- App is daily-driveable and stable
- Confidence that the API surface and data model won't change significantly
