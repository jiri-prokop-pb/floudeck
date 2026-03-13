# TODO

## UI simplification

- Replace permanent create form with a small `+` button at the bottom that opens a modal
- Strip card chrome: hide actions behind a hamburger menu (top-right)
- Show only the rendered result by default; move freshness info and frequency to a tooltip or `(i)` icon on hover
- Remove status lozenge — the card content itself is enough

## CI

- Set up CI pipeline with lint, unit tests, and E2E checks

## Packaging

- Figure out how to bundle as a standalone binary (Bun compile or Tauri)

## Runner configuration

- Allow configuring the `claude` invocation: `--dangerously-skip-permissions`, `--sandbox`, `cwd`, and other useful flags per block or globally

## Refresh UX

- Keep existing content visible during refresh; overlay a loading indicator instead of replacing with a spinner

## Post-PoC

- **Decks/pages/tabs** — multiple feeds with different card sets
- **Notifications** — sound & browser notifications, configurable per card
- **Custom actions** — per-card and per-item actions (prompt-based, running another `claude` instance; or shell commands); can render additional UI in a modal or fullscreen
- **Logging & debugging** — proper structured logging system for development
- **Cost tracking** — track API cost for the whole system and per card
- **History** — per-card run history with timestamps and past outputs
- **Advanced scheduling** — exceptions, start/end dates, self-destroying cards, cron-like expressions
