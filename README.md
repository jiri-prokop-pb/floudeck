# Floudeck

A local feed of scheduled blocks that run prompts through [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) and render the results as GFM markdown. Available as a native macOS app or run from source.

![Floudeck screenshot](docs/screenshot.png)

## Prerequisites

- [Bun](https://bun.sh/) (runtime, bundler, package manager)
- [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`claude` in your PATH)
- [Rust](https://rustup.rs/) + `cargo install tauri-cli` (only for building the desktop app)

## Run from source

```bash
bun install
bun run dev        # http://localhost:3000
```

## What it does

- Define blocks with a prompt and a repeat interval (minutes/hours/days)
- Each block runs through Claude Code CLI on schedule
- Output is GFM markdown rendered in a card
- SSE pushes updates to the browser in real time
- Blocks can be edited, refreshed, deleted, or reordered via drag-and-drop
- **Try mode** — test a prompt before saving (runs through CLI and shows result inline)
- Per-block and global runner configuration (model, timeout, permissions, cwd, env vars)
- Live date/time clock in header with calendar popover on hover
- Tabbed settings modal (Runner defaults, Display preferences)

## Build from source

```bash
bun install

# Build standalone server binary + client assets
bun run build:server    # → dist/floudeck-server + dist/client/

# Build macOS .app and .dmg
bun run build           # → src-tauri/target/release/bundle/

# Or dev mode with Tauri (live reload)
bun run dev:tauri
```

## Development

```bash
bun run test       # unit tests
bun run e2e        # Playwright E2E tests
bun run check      # lint + unit + E2E
bun run lint       # biome check
bun run format     # biome auto-fix
```

### Updating the README screenshot

When changing app visuals or functionality, regenerate the screenshot:

```bash
bun run scripts/screenshot.ts
```

This starts a temporary server with mock data, captures a screenshot via Playwright, and saves it to `docs/screenshot.png`. Requires `bunx playwright install chromium` first.

## Stack

Bun (server, bundler, SQLite, package manager), minimal React, Tailwind v4, `marked` (client-side markdown rendering), Tauri v2 (native app shell). No ORM, no router, no state library, no websockets.
