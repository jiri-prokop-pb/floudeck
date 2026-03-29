# TUI Mode — Research

Research date: 2026-03-29

## Vision

A separate mode/binary that renders Floudeck blocks in the terminal instead of a native window. Same blocks, same data, different interface. Could exist as:

1. **Read-only feed** — minimal: displays block cards with markdown output, auto-refreshes, keyboard navigation. Blocks are created/configured in the GUI.
2. **Interactive TUI** — full rework: menus, block creation/editing, settings, actions — all in terminal. More ambitious, essentially a parallel UI.
3. **Hybrid** — read-only feed with a few interactive features (manual refresh, quick actions, jump to block edit in GUI).

The read-only feed is the pragmatic starting point. Interactive TUI is the aspirational goal but significantly harder (forms, validation, menus in terminal are painful).

## Requirements

- Scrollable feed of block cards with markdown-rendered output
- Real-time updates (block status changes, new output)
- Keyboard navigation between blocks
- Markdown rendering with code blocks, headings, lists, tables
- Bun/TypeScript compatibility (existing stack) OR Rust (planned rewrite direction)
- Optionally: block creation/editing forms, menus, settings

---

## Framework Comparison

### 1. Ink (React for CLI)

| Attribute | Detail |
|-----------|--------|
| **Language** | TypeScript/JavaScript |
| **Stars** | 35.8k |
| **Status** | Actively maintained, v6.8.0, requires React >= 19 |
| **Layout** | Flexbox via Yoga engine — CSS-like props on `<Box>` |
| **Input** | Keyboard only (`useInput` hook with arrow keys, modifiers). No mouse support |
| **Scrolling** | No built-in scrollable containers. `overflow` prop exists but limited |
| **Mouse** | Not supported |
| **Notable users** | Claude Code, Gemini CLI, GitHub Copilot CLI, Cloudflare Wrangler, Prisma |

**Pros:**
- Direct React 19 compatibility — Floudeck already uses React 19. Component logic (state management, hooks patterns) can be shared or adapted
- Familiar mental model for the existing codebase. Same `useState`, `useEffect`, JSX patterns
- Ink v6 requires React 19, exactly what Floudeck uses
- Flexbox layout is powerful and well-understood
- Focus management built-in (`useFocus`, `useFocusManager`)
- Battle-tested at scale (Claude Code itself uses Ink)
- Strong TypeScript support
- Bun compatibility: Ink runs on Bun (it's a React reconciler, not Node-specific). Claude Code runs on Bun with Ink

**Cons:**
- No built-in scrolling — would need custom implementation for scrollable block feed
- No mouse support — purely keyboard-driven
- No built-in markdown renderer component. Would need to build one using `<Text>` with ANSI styling, or use `marked-terminal` to pre-render markdown to ANSI strings
- Ink's component ecosystem is thin for complex layouts (no grid, no panels, no tabs built-in)
- Re-rendering model can cause flicker in complex layouts
- Third-party component ecosystem is sparse and sometimes unmaintained

**Markdown rendering approach:** Use `marked` (already a dependency) with `marked-terminal` renderer to convert markdown to ANSI-styled strings, then render inside Ink `<Text>` components. Alternatively, build a custom Ink component that walks the marked AST and maps to `<Text>` with appropriate styling.

**Complexity:** Low-medium. Familiar patterns, but missing primitives (scroll, markdown) would need custom work.

---

### 2. Blessed / neo-blessed / blessed-contrib

| Attribute | Detail |
|-----------|--------|
| **Language** | JavaScript |
| **Stars** | 11.8k (blessed), ~500 (neo-blessed) |
| **Status** | **Effectively abandoned.** blessed last meaningful commit ~2017. neo-blessed is a fork with minor fixes, also stale |
| **Layout** | Absolute/relative positioning, percentage-based sizing. Not flexbox |
| **Input** | Full keyboard + mouse support |
| **Scrolling** | Built-in scrollable boxes, lists, tables |
| **Mouse** | Yes — click, scroll wheel |

**Pros:**
- Rich widget set: scrollable lists, tables, forms, text areas, progress bars, trees
- Mouse support out of the box
- blessed-contrib adds dashboards, gauges, maps, sparklines — closest to a "dashboard TUI" out of the box
- Mature (battle-tested in many tools)

**Cons:**
- **Dead project.** No active maintainer. 204+ open issues on blessed, many years old
- Node.js-era code, not TypeScript-native. Type definitions are community-maintained and incomplete
- Bun compatibility: untested and likely problematic (relies on Node TTY internals)
- No React integration — completely different programming model
- API is callback-heavy and imperative, not declarative
- Buggy edge cases that will never be fixed
- No code sharing with existing Floudeck React codebase

**Verdict: Not recommended.** The abandonment alone disqualifies it. Too risky to build on.

---

### 3. Ratatui (Rust)

| Attribute | Detail |
|-----------|--------|
| **Language** | Rust |
| **Stars** | 19.4k |
| **Status** | Very actively maintained, v0.30.0 (Dec 2025), 124 releases |
| **Layout** | Constraint-based layout system (percentages, min/max, ratios) |
| **Input** | Full keyboard + mouse via crossterm backend |
| **Scrolling** | Built-in scrollable widgets (List, Table, Paragraph) |
| **Mouse** | Yes — via crossterm event handling |
| **Notable users** | gitui, bottom, oha, many Rust CLI tools |

**Pros:**
- Most capable layout system of all options — constraints, nested layouts, percentage-based splits
- Rich built-in widgets: Paragraph (text with wrapping/scrolling), List, Table, Tabs, Block (bordered containers with titles), Gauge, Chart, Sparkline
- `Block` widget is literally a titled bordered card — maps perfectly to Floudeck's block concept
- Excellent scrolling support on all text widgets
- Mouse support via crossterm
- **termimad** crate (1.2k stars) provides terminal markdown rendering for Rust, or build custom with ratatui's `Text`/`Line`/`Span` primitives
- Aligns with planned Rust rewrite direction — a TUI could become the "lightweight client" mentioned in the Rust research
- Blazing fast rendering, minimal resource usage
- 13.5k dependent projects — huge ecosystem
- Could share the SQLite database layer with the existing Bun server (same DB file)

**Cons:**
- Zero code sharing with existing React/TypeScript codebase
- Rust learning curve if team isn't fluent
- Immediate-mode rendering (redraw every frame) is different from React's declarative model — requires manual state management
- No built-in form widgets (text input exists in third-party crates like `tui-input`, `tui-textarea`)
- Would need to implement its own scheduler/runner or communicate with the existing Bun server via HTTP API

**Markdown rendering:** `termimad` (1.2k stars, actively maintained, v0.31.3) renders markdown directly to terminal with crossterm. Handles headings, bold, italic, code blocks, tables, lists. Alternatively, ratatui's own `Paragraph` widget with styled `Span`s can render pre-parsed markdown.

**Complexity:** Medium-high. Powerful but requires Rust expertise and building the data layer (or HTTP client to existing server).

---

### 4. Textual (Python)

| Attribute | Detail |
|-----------|--------|
| **Language** | Python |
| **Stars** | 35.1k |
| **Status** | Very actively maintained, 12.9k commits |
| **Layout** | CSS-based (actual CSS subset for terminal layouts) |
| **Input** | Keyboard + mouse |
| **Scrolling** | Built-in on most widgets |
| **Mouse** | Full mouse support including click, scroll, hover |

**Pros:**
- Most "web-like" TUI framework — uses actual CSS for styling and layout
- Built-in markdown rendering widget (`Markdown` and `MarkdownViewer`)
- Richest widget library: DataTable, Tree, TabbedContent, Input, TextArea, Select, ListView, etc.
- Can serve apps in web browsers via `textual serve` (dual terminal/web)
- Built-in dev tools and testing framework
- Would produce the most polished-looking TUI with least effort

**Cons:**
- **Python** — completely outside Floudeck's stack (TypeScript/Rust). Adds a runtime dependency
- Zero code sharing with existing codebase
- Would need to communicate with Bun server via HTTP API or read SQLite directly (Python has sqlite3 built-in)
- Adds Python as a deployment dependency
- Different language expertise required

**Verdict:** Impressive framework but wrong language for this project. Mentioned for completeness. Only viable if the TUI were a fully separate tool that reads the same SQLite DB.

---

### 5. Bubbletea (Go)

| Attribute | Detail |
|-----------|--------|
| **Language** | Go |
| **Stars** | 41k |
| **Status** | Very actively maintained (commit from today, 2026-03-29) |
| **Layout** | Via Lip Gloss (10.9k stars) — CSS-like styling with padding, margins, borders |
| **Input** | Keyboard + mouse |
| **Scrolling** | Via Bubbles component library (viewport, paginator, list) |
| **Mouse** | Yes |
| **Notable users** | 18k+ apps including Azure tools, glow, gh-dash |

**Pros:**
- Elm architecture (Model-View-Update) is clean and predictable
- Lip Gloss provides excellent terminal styling (borders, colors, alignment)
- **glamour** (3.4k stars, v2.0.0) provides stylesheet-based markdown rendering — the best terminal markdown solution across any ecosystem
- **glow** (24k stars) is literally a terminal markdown reader built with Bubbletea+glamour — proves the concept works beautifully
- Bubbles library provides viewport (scrollable), list, text input, spinner, paginator, table, file picker
- Compiles to single binary — easy distribution
- Excellent documentation and examples

**Cons:**
- **Go** — outside Floudeck's stack. Zero code sharing
- Would need HTTP client to communicate with Bun server, or read SQLite directly (Go has good sqlite drivers)
- Different language expertise required
- Elm architecture can feel verbose for simple UIs

**Verdict:** Best-in-class TUI framework with the best markdown rendering story (glamour/glow), but wrong language. Similar trade-off as Textual.

---

### 6. Other Options

#### terminal-kit (Node.js)
- 3.4k stars, JavaScript
- Full-featured: 256 colors, input fields, menus, progress bars, screen buffer
- Less popular than Ink, unclear maintenance status
- No React integration, imperative API
- **Verdict:** No compelling advantage over Ink

#### Cliffy (Deno/TypeScript)
- Deno-first CLI framework, not a TUI framework
- Provides prompts, tables, but not persistent TUI layouts
- **Verdict:** Not applicable

#### React-blessed
- React bindings for blessed — combines React with blessed widgets
- **Dead** — depends on the abandoned blessed library
- **Verdict:** Not recommended

#### FTXUI (C++)
- Functional TUI for C++. Clean API, flexbox-like layout
- Wrong language, no ecosystem overlap
- **Verdict:** Not applicable

---

## Terminal Markdown Rendering

| Library | Language | Stars | Approach |
|---------|----------|-------|----------|
| **glamour** | Go | 3.4k | Stylesheet-based, best visual quality. Powers `glow` |
| **termimad** | Rust | 1.2k | Markdown-to-terminal with crossterm. Tables, code blocks, wrapping |
| **marked-terminal** | JS | ~1k | `marked` renderer that outputs ANSI strings. Drop-in with existing `marked` setup |
| **cli-markdown** | JS | ~200 | Simple markdown-to-ANSI conversion |
| **rich** | Python | 50k+ | Python library with `Markdown` class for terminal rendering |

For a TypeScript TUI: **marked-terminal** is the natural choice since Floudeck already uses `marked`. It plugs in as a custom renderer.

For a Rust TUI: **termimad** integrates well with ratatui's crossterm backend.

---

## Similar Dashboard/Feed TUI Apps (Reference)

- **glow** (Go/Bubbletea) — terminal markdown reader with file browser. 24k stars
- **gh-dash** (Go/Bubbletea) — GitHub dashboard in terminal. Shows PRs/issues in scrollable lists with status indicators
- **lazydocker** (Go/gocui) — Docker dashboard with panels, real-time updates
- **bottom** (Rust/ratatui) — system monitor with multiple panels, real-time updates, charts
- **gitui** (Rust/ratatui) — git TUI with panels, lists, diffs
- **k9s** (Go/tview) — Kubernetes dashboard in terminal
- **wtfutil** (Go/tview) — personal terminal dashboard with configurable modules — closest conceptual match to Floudeck

---

## Recommendation

### Primary recommendation: **Ink**

**Rationale:**
1. **Code sharing is the killer feature.** Floudeck uses React 19; Ink v6 requires React 19. Hooks, state management patterns, and even some component logic can be shared or adapted. No other option offers this.
2. **Same language, same runtime.** TypeScript on Bun. No new language dependencies, no new build tooling, no new expertise required.
3. **Proven at scale for this exact use case.** Claude Code — a tool that displays structured CLI output with real-time updates — uses Ink. This validates the approach.
4. **Direct access to existing backend.** The TUI can import and use the same `db.ts`, `scheduler.ts`, `runner.ts` modules. No HTTP API needed between TUI and backend — it IS the backend. This is a massive simplification.
5. **Incremental path.** Start with read-only block display, add interactivity later. Ink's component model supports this well.

**What you'd need to build custom:**
- Scrollable container for the block feed (Ink lacks this natively — implement with `useInput` + viewport slicing, similar to how Claude Code handles long output)
- Markdown renderer: use `marked-terminal` to convert markdown to ANSI strings, render in `<Text>` components
- Block card component with borders (use `<Box borderStyle="round">` or similar)
- Status indicators (running/idle/error) with colored `<Text>`

**Architecture sketch:**
```
src/tui.ts (entry point, import.meta.main)
  └── imports db.ts, scheduler.ts, runner.ts, sse.ts directly
  └── renders <App> with Ink
        ├── <BlockList> — scrollable feed of blocks
        │     └── <BlockCard> — bordered box with title, status, markdown output
        ├── <StatusBar> — scheduler status, block count
        └── <CommandBar> — keyboard shortcuts reference
```

### Secondary recommendation: **Ratatui** (if pursuing Rust rewrite)

If the Rust rewrite proceeds, Ratatui is the clear choice for the Rust ecosystem. It has the richest widget set, excellent scrolling, mouse support, and `termimad` for markdown. The `Block` widget is a perfect fit. This would make sense as part of a broader "rewrite everything in Rust" effort, but not as a standalone addition to the current TypeScript codebase.

### Not recommended for this project
- **Blessed/neo-blessed** — abandoned
- **Textual** — wrong language (Python)
- **Bubbletea** — wrong language (Go), though glamour/glow prove the concept beautifully
- **terminal-kit** — no advantage over Ink, less ecosystem
