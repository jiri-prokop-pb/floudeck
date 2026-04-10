# TODO

## Improve how scheduling works

- For "days" unit, have field for at what hour, it should be triggered
- For "hours" and "minutes", it should start at 0 of sub-units and always calculated from 0 of the unit itself
- In order to avoid problems with rate limits, make sure that we queue update requests; do it serially or in small batches (2-3 updates at the time, but always offset slightly)
  - This mechanism will be base for "Optimize scheduling" section, where we need similar thing
- We just need eventual consistency, no perfect timing!
- The queue should be smart enough to understand there is pending update for the same block and either remove it so only one remains or just "group" them and do a single update for it!
- Client will show "refresh" indicator at the point when it asks for update (or rather when it's appears in queue and until it's fully processed!)

## Optimize scheduling

- Rework how scheduling works, controlled from the client and only update when Floudeck is visible
- This is to optimize how often we trigger the updates
- Basically when user have Floudeck somewhere on secondary monitor, update as frequently as possible (and as defined) 
- We need some "smart" logic that will understand block requires an update (ie. when it becomes visible again) and it schedules it in background (and it indicates it on the block)
- This also means, the server can continue running but if no client is opened, don't do any updates!
- If there are more clients, only do one update per block on server! It's triggered by client but guarded and executed by server!

## Manual refresh

- Add ability to manually trigger an update of all blocks
- Be aware of possible rate limits => update blocks serially or in batches; if there are 20 blocks, updating all of them at exactly same moment wouldn't be good idea!

---

## Custom actions — future improvements

V1 is implemented. See **[docs/custom-actions-spec.md](docs/custom-actions-spec.md)** for the full technical spec.

- Real-time streaming of action output (stream stdout via SSE instead of wait-for-completion)
- User-defined "actions prompt" per block or globally
- Conversational follow-ups on action page (multi-turn chat)
- Action link format linting (detect malformed links in block output)
- Action page back navigation: track route history so "Back" goes to the previous action page (not always feed). Show "Back to feed" only when feed is the previous entry, otherwise "Back to {action name}"

---

## Packaging — future improvements

- **Code signing & notarization** — required for clean distribution (no Gatekeeper warnings). Needs Apple Developer Program ($99/year). Configure in `tauri.conf.json` `bundle.macOS.signing`.
- **Auto-updater** — Tauri has built-in updater support. Only worth adding if app gains traction.
- **Tray icon / background mode** — keep running when window is closed
- **Windows/Linux builds** — Tauri supports all three platforms

---

## Block runner types & streaming

See **[docs/design-block-runners.md](docs/design-block-runners.md)** for the full design document.

Phases:
1. ~~CLI streaming (Try panel)~~ ✓ — feed block streaming still pending
3. Runner type system + bun-script runner
4. Claude Agent SDK runner
5. API & external AI tools (deferred)

## Action blocks

A new block type that doesn't auto-schedule — it only runs on demand with user input. Essentially a container for multiple user-triggered actions.

- A block with `schedule: "manual"` — never auto-runs, no timer, no output of its own
- Each action block contains **multiple actions**, each with:
  - Name & label (displayed as a button)
  - Its own prompt template with `{{input}}` placeholders (or structured form schema)
  - Its own runner config (model, cwd, permissions, timeout, env) — like a block inside a block
- When an action button is clicked: shows an input form (free text or structured fields), substitutes into prompt, runs, shows result on the action page
- Lives in the feed alongside regular blocks (rendered as a card with action buttons instead of markdown output)
- Existing action infrastructure (action page, caching, cleanup) reused for execution & display
- Will likely need `actionUUID` (instead of current `blockUUID`-based routing) to identify individual actions within a block — to be figured out during planning
- Start simple: single free-text input per action, extend to structured fields later

---

## Promo video — fully automated pipeline

Goal: `bun run promo:generate` regenerates the entire video from script to MP4 with no manual steps. Used for release videos (full + short feature-only variants). Target: ~2 minutes, current music stays.

See **[promo/PIPELINE.md](promo/PIPELINE.md)** for full architecture, current state, and tooling details.

Phases:
1. **Unify voiceover** — single command, auto-normalize, auto-update `constants.ts` durations, per-segment generation (drop Whisper dependency)
2. **SFX generation** — local text-to-SFX via Stable Audio Open Small, prompts defined in script, fallback to curated CC0 library
3. **Music** — keep manual for now, add `--skip-music` flag; explore Suno API or Stable Audio Open 1.0 later
4. **Script-driven generation** — single typed script file drives all content; scenes become generic templates
5. **One-command pipeline** — `promo:generate [--short] [--skip-music] [--segment N]`, optional CI integration

---

## Post-PoC

- **React Router v7** — adopt loaders for route-level data fetching, route-level code splitting; replaces manual pushState routing in useRouter.ts
- **Reminders** — one time or regular reminders that should show one time card at the top of the feed, in different style/color, (can be just a message, some calculated info and can contain actions), play sound and show a notification, all optional
  - Could also support "tell me when X happens" style — e.g. "tell me when HiBob is up again". The system figures out how to check (ideally via a generated script; if not, it prepares a prompt for its own `claude` instance). There's an API/contract for reminders to fire notifications (with action support). Could reuse block architecture as "conditional blocks" — always scheduled but only shown when the condition triggers. Extended scheduling: the contract allows reminders to reschedule themselves (change frequency) or stop completely. Needs careful design — braindump for now.
- **Decks/pages/tabs** — multiple feeds with different card sets; action blocks can be grouped onto a dedicated deck
- **Notifications** — sound & native notifications, configurable per card. See **[docs/notifications-and-sounds.md](docs/notifications-and-sounds.md)** for implementation notes
- **Logging & debugging** — proper structured logging system for development
- **History** — per-card run history with timestamps and past outputs
- **Advanced scheduling** — exceptions, start/end dates, self-destroying cards, cron-like expressions
- **Cost tracking** — track API cost for the whole system and per card
- **Claude Agent SDK & other runners** — see [docs/design-block-runners.md](docs/design-block-runners.md)
- **Rust rewrite** — remove Bun/JS backend entirely, move all server logic into native Rust inside Tauri. Eliminates sidecar process, shrinks bundle by ~50MB, replaces HTTP API with Tauri Commands and SSE with Tauri Events. Frontend (React) stays, only `api.ts` and `useSse.ts` change. ~2-3 week effort. See **[docs/rust-rewrite.md](docs/rust-rewrite.md)** for full analysis
- **TUI mode** — terminal UI for Floudeck, same blocks rendered in a terminal window. Could be read-only feed display or full interactive UI with block creation/editing. Primary candidate is Ink (React for CLI) for code sharing with existing React codebase; Ratatui if Rust rewrite proceeds. See **[docs/tui-research.md](docs/tui-research.md)** for framework comparison
- **Block chat** — ability to "chat" with a block: open a conversational interface on a block's output, ask follow-up questions, and refine results interactively. Extending this to actions (opening a chat from an action page) could be especially powerful for multi-turn workflows
- **Replace `marked` with Bun's built-in Markdown** — Bun has [native GFM-compatible Markdown rendering](https://bun.sh/docs/runtime/markdown). Research whether it covers our use-cases (custom renderer hooks, action link parsing, HTML stripping) and refactor to drop the `marked` dependency if it fits
