# TODO

## Use markdown output instead of HTML

- Instead of dealing with HTML sanitization and weird layout issues, let's utilize https://github.github.com/gfm/
- Adjust system prompt, there should always be Heading 1 (`#`) at the top => it will be used as card's title (and should be indicative of what the card content is about)
- Links and lists are easy to do, as well as images (but for that they will need to be small and base64 encoded)

## Refresh UX

- Keep existing content visible during refresh; overlay a loading indicator instead of replacing with a spinner

## Runner configuration

- Allow configuring the `claude` invocation: `--dangerously-skip-permissions`, `--sandbox`, `cwd`, and other useful flags per block or globally

## Custom actions

- Per-card and per-item actions (prompt-based, running another `claude` instance; or shell commands); can render additional UI in a modal or fullscreen

## Implement ability to also prompt scripts that will provide the output

- Instead of always calling `claude` and burn tokens on something straigforward, we could instruct the initial `claude` instance to come up with a script
- We would have some folder where these scripts could be saved safely
- We would still save the prompt but we als need some flag & field to have the script saved there
- In case the script still need some conditional reasoning, it can call nested `claude` instance with some input/output logic

## Post-PoC

- **Reminders** — one time or regular reminders that should show one time card at the top of the feed, in different style/color, (can be just a message, some calculated info and can contain actions), play sound and show a notification, all optional
- **Decks/pages/tabs** — multiple feeds with different card sets
- **Notifications** — sound & browser notifications, configurable per card
- **Logging & debugging** — proper structured logging system for development
- **Cost tracking** — track API cost for the whole system and per card
- **History** — per-card run history with timestamps and past outputs
- **Advanced scheduling** — exceptions, start/end dates, self-destroying cards, cron-like expressions
- **CI** — Set up CI pipeline with lint, unit tests, and E2E checks
- **Packaging** — Figure out how to bundle as a standalone binary (Bun compile or Tauri)
- **Other tools/AI** — Allow user to specify what tool/script to use/run; eventually we can also support regular AI over API/Ollama and so on (but that's quite complex)
