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
- **Homebrew tap** — once repo is public
- **Tray icon / background mode** — keep running when window is closed
- **Windows/Linux builds** — Tauri supports all three platforms

---

## Block runner types & streaming

See **[docs/design-block-runners.md](docs/design-block-runners.md)** for the full design document.

Phases:
1. Interactive "Try" mode (foundation)
2. CLI streaming (Try panel + feed)
3. Runner type system + bun-script runner
4. Claude Agent SDK runner
5. API & external AI tools (deferred)

## Post-PoC

- **Reminders** — one time or regular reminders that should show one time card at the top of the feed, in different style/color, (can be just a message, some calculated info and can contain actions), play sound and show a notification, all optional
  - Could also support "tell me when X happens" style — e.g. "tell me when HiBob is up again". The system figures out how to check (ideally via a generated script; if not, it prepares a prompt for its own `claude` instance). There's an API/contract for reminders to fire notifications (with action support). Could reuse block architecture as "conditional blocks" — always scheduled but only shown when the condition triggers. Extended scheduling: the contract allows reminders to reschedule themselves (change frequency) or stop completely. Needs careful design — braindump for now.
- **Decks/pages/tabs** — multiple feeds with different card sets
- **Notifications** — sound & browser notifications, configurable per card
- **CI** — set up CI pipeline with lint, unit tests, and E2E checks
- **Logging & debugging** — proper structured logging system for development
- **History** — per-card run history with timestamps and past outputs
- **Advanced scheduling** — exceptions, start/end dates, self-destroying cards, cron-like expressions
- **Cost tracking** — track API cost for the whole system and per card
- **Claude Agent SDK & other runners** — see [docs/design-block-runners.md](docs/design-block-runners.md)
