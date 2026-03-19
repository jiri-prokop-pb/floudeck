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
- Nested action history with breadcrumb navigation

---

## Packaging

— Research and figure out how to bundle the project as a standalone binary
  - bun compile: could be initial version; only bundles the server, then used in browser
  - Tauri: better option, both server & client are bundled; this makes sure only one instance is running
- Things to figure out:
  - Where to save persistent data?
  - Can we easily run any commands?
  - How about MacOS & notarization?
  - Where to release?
  - How to do updates? At that point, we need db migrations?

---

## Implement ability to also prompt scripts that will provide the output

- Instead of always calling `claude` and burn tokens on something straigforward, we could instruct the initial `claude` instance to come up with a script
- We would have some folder where these scripts could be saved safely
- We would still save the prompt but we als need some flag & field to have the script saved there
- In case the script still need some conditional reasoning, it can call nested `claude` instance with some input/output logic

## Real-time output streaming

- Stream claude's stdout in real-time so users can watch blocks being processed
- Requires per-block SSE streaming or a log file the UI can tail
- Helps users fine-tune prompts by seeing what's happening during execution

## Post-PoC

- **Reminders** — one time or regular reminders that should show one time card at the top of the feed, in different style/color, (can be just a message, some calculated info and can contain actions), play sound and show a notification, all optional
- **Decks/pages/tabs** — multiple feeds with different card sets
- **Notifications** — sound & browser notifications, configurable per card
- **CI** — set up CI pipeline with lint, unit tests, and E2E checks
- **Logging & debugging** — proper structured logging system for development
- **History** — per-card run history with timestamps and past outputs
- **Advanced scheduling** — exceptions, start/end dates, self-destroying cards, cron-like expressions
- **Cost tracking** — track API cost for the whole system and per card
- **Claude Code SDK** — should we use CC SDK instead of CLI? This would also enable proper permission handling (detecting permission requests, asking user to allow/deny, remembering choices for future runs)
- **Other tools/AI** — allow user to specify what tool/script to use/run; eventually we can also support regular AI over API/Ollama and so on (but that's quite complex)
