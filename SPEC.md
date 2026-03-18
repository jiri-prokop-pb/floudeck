# Floudeck — Product Spec

A local feed of scheduled blocks that run prompts through Claude Code CLI and render GFM markdown results.

**Core loop:** scheduled prompt → Claude Code CLI → markdown output → feed update

## How it works

Floudeck is a single-page web app running locally. Users create **blocks** — each block has a prompt, a repeat interval, and optional runner configuration. Blocks execute on schedule, and the latest result is rendered as a markdown card in a vertical feed.

The feed is ordered by creation time (not last update), keeping the layout stable.

## Features

### Blocks

- Create, edit, delete blocks
- Each block has: prompt, interval (minutes/hours/days), optional runner config
- Manual refresh per block
- Only the latest output is stored (no history)

### Scheduling

- Automatic execution on interval
- Single catch-up run after sleep/wake or downtime (no burst)
- Per-block overlap forbidden; global concurrency cap of 2
- Immediate first run on create or edit

### Runner configuration

- **Per-block and global defaults** — global defaults apply to all blocks unless overridden
- **Model** — which Claude model to use (default: sonnet)
- **Working directory** — per-block only; defaults to `~/.floudeck/blocks-workspace/{uuid}`
- **Permissions** — `"default"` (respects user's Claude Code settings including sandbox) or `"dangerouslySkipPermissions"`
- **Timeout** — per-block execution timeout in seconds (default: 60)
- **Environment variables** — literal values or inherited from the host process
- **CLI command visibility** — info popover shows the resolved config and CLI command for each block

### Output

- Claude outputs GFM markdown with `# Title` as first line
- Reasoning and markdown are separated by delimiters; only markdown is stored and rendered
- Raw HTML stripped client-side by `marked` renderer
- Missing/empty markdown treated as error

### Real-time updates

- SSE notifications push block state changes to the browser
- Client refetches actual data via JSON endpoints (SSE is notification-only)

### UI

- Single page, centered feed layout
- Block cards show rendered markdown, error state, or loading spinner
- Inline edit form with collapsible "Advanced settings" for runner config
- **Header clock** — live date & time display (day name + date + time); calendar popover on hover showing current month with today highlighted
- **Settings modal** — tabbed layout (Runner, Display) with gear icon in header
  - Runner tab: global runner defaults (model, permissions, timeout, env)
  - Display tab: date format and time format (24h/12h) preferences
- Block info popover with schedule, resolved config, and CLI command

### Error handling

- Error card replaces block content with clear message
- Covers: CLI missing, non-zero exit, timeout, empty output, invalid delimiters
- User-facing messages only; raw stderr stays server-side

## Not included (current)

- Run history or logs
- Cron syntax or advanced scheduling
- Real-time output streaming (planned)
- Multiple users or authentication
- Interactive permission handling (planned via Claude Code SDK)
- Drag-and-drop ordering, folders, tags
- Month navigation in calendar popover
- Notifications (sound/browser)

## Planned

See TODO.md for the full list. Key upcoming areas:

- **Real-time output streaming** — watch Claude's output as it runs
- ~~**Date & time** — header clock, calendar widget~~ (done)
- **Improved scheduling** — time-of-day for daily blocks, smarter queuing
- **Visibility-based scheduling** — only update when Floudeck is visible
- ~~**Settings expansion** — date/time formats and other preferences~~ (done)
- **Custom actions** — per-card prompt-based or shell actions
- **Script-based prompts** — generate scripts instead of always calling Claude
- **Packaging** — standalone binary via bun compile or Tauri
- **Claude Code SDK** — replace CLI with SDK for better permission handling and introspection
