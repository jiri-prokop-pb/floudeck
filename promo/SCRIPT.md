# Floudeck Promo Video — Production Script

**Total duration:** ~88 seconds | **Resolution:** 1920x1080 | **FPS:** 30 | **Total frames:** 2640

---

## Audio Plan

### Voiceover (ElevenLabs)

- **Voice:** Deep, confident male narrator. Movie-trailer energy but self-aware.
- **Style:** Slightly dramatic, knows it's a bit ridiculous and leans into it.
- **Pacing:** Varies — slow/dramatic for cold open, rapid-fire for features, whisper for danger zone, fast-talk for caveats.

### Music

- **Genre:** Synthwave / retro-futuristic (80s synth, modern production)
- **Arc:**
  - 0:00–0:12 — Dark, atmospheric pad. Low rumble.
  - 0:12–0:20 — Bass drop on title reveal, energy builds.
  - 0:20–0:50 — Driving beat, confident. Think "montage energy."
  - 0:50–0:58 — Record scratch → ominous synth for danger zone.
  - 0:58–1:10 — Hype energy crescendo for "coming soon" features.
  - 1:10–1:20 — Sudden shift to pharmaceutical-ad muzak for caveats.
  - 1:20–1:28 — Clean, confident resolution for install/CTA/outro.

### Sound Effects

| Timestamp | SFX | Notes |
|-----------|-----|-------|
| 0:12 | Bass hit / impact | Title slam |
| 0:50 | Record scratch | Transition to danger zone |
| 0:52 | Explosion / fire woosh | `--dangerously-skip-permissions` |
| 1:03 | Angelic choir + shimmer | "Rust Rewrite" mention |
| 1:10 | Rapid whoosh (x6) | Caveat text flying in |

---

## Segments

---

### 1. COLD OPEN — 0:00–0:12 (12s, 360 frames)

**Voiceover:**
> You open your laptop. 47 Slack messages. 12 PRs to review. 3 incidents.
> And it's only Monday.
> *(beat)*
> What if your AI already handled it?

**Visuals:** Dark screen. Each pain point types in, monospace font, centered. Slight screen flicker. Final line fades in with a glow.

**Music:** Low rumble, building tension.

---

### 2. TITLE DROP — 0:12–0:17 (5s, 150 frames)

**Voiceover:**
> Floudeck. Claude Code — on autopilot.

**Visuals:** Floudeck logo slams in center-screen with impact animation. Tagline fades in below. Radial indigo glow behind logo.

**Music:** Bass hit on logo reveal, synth builds.

---

### 3. THE PROBLEM + SOLUTION — 0:17–0:32 (15s, 450 frames)

**Voiceover:**
> You love Claude Code. You use it every day. But you're tired of asking the same things. Over. And over. And over.
> Floudeck runs your prompts on a schedule, renders the output in a beautiful markdown feed.
> One glance — and you know everything.
> Like Claude Code's loop mode... but on steroids. Legal steroids.

**Visuals:**
- 0:17–0:22: Text animation — "Over." zooms bigger each time.
- 0:22–0:32: **[JIRI: UI screen recording]** — Show the main feed with 3-4 blocks running, markdown output visible. Quick pan/scroll through the feed. End on a clean overview shot.

**Music:** Beat kicks in at 0:22, driving and confident.

---

### 4. FOR POWER USERS — 0:32–0:38 (6s, 180 frames)

**Voiceover:**
> This isn't for beginners. This is for people who dream in system prompts.
> Who have strong opinions about token efficiency.

**Visuals:** Text flies in with each phrase, styled like "hacker aesthetic" — green-on-black terminal font, then morphs into the clean Floudeck UI. Quick transition.

**Music:** Steady driving beat continues.

---

### 5. FEATURES SHOWCASE — 0:38–0:50 (12s, 360 frames)

**Voiceover:**
> Scheduled prompts. Markdown rendering. Drag and drop.
> Action links — colored, clickable, nested.
> Try mode to debug your prompts. Per-block config. Real-time updates.
> If there's an API, MCP, or CLI for it — you can automate it.

**Visuals:** Rapid feature cards (2s each) with **[JIRI: UI screenshots/recordings]**:
- 0:38–0:40: Block creation form → schedule config
- 0:40–0:42: Rich markdown output card with action link pills
- 0:42–0:44: Action link click → nested action page
- 0:44–0:46: Try mode in action (prompt being tested)
- 0:46–0:48: Settings / runner config panel
- 0:48–0:50: Quick montage — "API? MCP? CLI?" text with checkmarks appearing

**Music:** Energetic, each card transition has a subtle whoosh.

---

### 6. THE DANGER ZONE — 0:50–0:58 (8s, 240 frames)

**Voiceover:**
> *(record scratch)*
> Oh, and there's `--dangerously-skip-permissions`.
> *(drops to whisper)*
> Use at your own risk. We are not responsible for what Claude does at 3 AM. Unsupervised.

**Visuals:**
- 0:50: Record scratch — music cuts. Screen goes red.
- 0:51–0:54: The flag types out in massive monospace text, each character shaking slightly.
- 0:54–0:58: **[JIRI: Short meme video or animation]** — Suggestion: "This is fine" dog meme but the dog is labeled "your codebase" and the fire is labeled "Claude with skip-permissions at 3 AM". Or: explosion VFX behind the terminal text.
- Small disclaimer text at bottom: "Seriously though. Set your permissions correctly."

**Music:** Ominous synth, single piano notes. Fire/explosion SFX.

---

### 7. COMING SOON — 0:58–1:10 (12s, 360 frames)

**Voiceover:**
> And we're just getting started.
> Standalone actions. Script mode — let Claude figure it out.
> Chat with your blocks. Claude Agent SDK.
> Smart reminders. Decks. Notifications. History. Cost tracking. TUI mode.
> And the holy grail...
> *(reverent whisper)* ...the Rust rewrite.

**Visuals:** Each feature name flies in from different directions, stacking into a grid. Fast-paced, hype energy. On "Rust rewrite" — everything pauses, angelic light rays burst from the text, subtle lens flare, choir SFX.

**Music:** Building crescendo, peaks at "Rust rewrite" with choir hit.

---

### 8. THE FINE PRINT — 1:10–1:20 (10s, 300 frames)

**Voiceover (fast-talk, pharmaceutical disclaimer style):**
> Things to know: quality of your prompt matters, it runs the claude process under the hood, each block runs in its own folder, there's a try-and-debug mode, permissions need to be set correctly, sandbox mode is available if configured, it can consume tokens like a teenager consumes WiFi, prefer low-frequency updates — once a day, maybe once every few hours — at least until we ship script mode.

**Visuals:** Text scrolls rapidly at the bottom of screen (classic pharmaceutical ad style). Main visual: **[JIRI: Split-screen meme]** — Left: "Responsible Floudeck user" (calm, one block running per day). Right: "You after discovering skip-permissions" (chaos, 47 blocks running every minute, flames).

**Music:** Suddenly switches to generic corporate hold music / pharmaceutical ad muzak. Comedic contrast.

---

### 9. INSTALL + CTA — 1:20–1:25 (5s, 150 frames)

**Voiceover:**
> One command. That's it.

**Visuals:**
```
brew install --cask jiri-prokop-pb/tap/floudeck
```
Types out in terminal style, centered. GitHub logo + URL appears below:
```
github.com/jiri-prokop-pb/floudeck
```
"Star it. Fork it. Judge our code." fades in.

**Music:** Clean, confident synth resolution.

---

### 10. OUTRO — 1:25–1:28 (3s, 90 frames)

**Voiceover:**
> Floudeck. Because you have better things to do.
> *(beat)*
> Actually, you probably don't. But still.

**Visuals:** Logo centered, tagline below. Fade to black.

**Music:** Final synth chord, fade out.

---

## Production Checklist

### Claude handles (voiceover, SFX, music, Remotion scenes)

- [ ] Record voiceover segments on ElevenLabs (split by segment for timing control)
- [ ] Generate/source music track (synthwave, ~90s, with arc described above)
- [ ] Source/generate sound effects (bass hit, record scratch, explosion, angelic choir, whooshes)
- [ ] Build Remotion scenes for all segments (text animations, transitions, layout)
- [ ] Integrate voiceover + music + SFX into Remotion timeline
- [ ] Composite UI recordings into feature showcase segments

### Jiri handles (illustration assets)

These are needed to make specific segments visually compelling. Exact placement is noted in the segment descriptions above.

1. **UI screen recording — Main feed** (Segment 3, 0:22–0:32)
   - Show the Floudeck feed with 3-4 blocks, some running, some with rich markdown output.
   - Slow scroll/pan through the feed. ~10 seconds of footage, we'll use the best parts.

2. **UI screenshots/recordings — Feature showcase** (Segment 5, 0:38–0:50)
   - Block creation form with schedule config visible
   - A block card with colored action link pills in the output
   - Action link click → action page with result (the nested action flow)
   - Try mode: prompt being tested, output appearing
   - Settings page / runner config panel
   - ~2 seconds of usable footage per feature, 6 clips total.

3. **Meme/animation — Danger zone** (Segment 6, 0:54–0:58)
   - Option A: "This is fine" dog meme variant — dog labeled "your codebase", fire labeled "Claude with --dangerously-skip-permissions at 3 AM"
   - Option B: Short explosion/fire animation behind the terminal text
   - Option C: Your own creative take — just needs to sell "this is powerful but chaotic"
   - ~4 seconds, can be static image with slight animation or short video.

4. **Meme — Fine print** (Segment 8, 1:10–1:20)
   - Split-screen comparison meme:
     - Left: "Responsible Floudeck user" — serene, one block, zen vibes
     - Right: "You after discovering skip-permissions" — chaos, dozens of blocks, everything on fire
   - ~10 seconds on screen. Can be a single image, we'll handle the animation.

---

## Voiceover Script (clean, for ElevenLabs)

Copy-paste this into ElevenLabs. Pause markers noted as `[pause]`.

```
You open your laptop. 47 Slack messages. 12 PRs to review. 3 incidents.
And it's only Monday.
[pause 1.5s]
What if your AI already handled it?
[pause 0.8s]

Floudeck. Claude Code — on autopilot.
[pause 0.5s]

You love Claude Code. You use it every day. But you're tired of asking the same things. Over. And over. And over.
Floudeck runs your prompts on a schedule, renders the output in a beautiful markdown feed.
One glance — and you know everything.
Like Claude Code's loop mode... but on steroids. Legal steroids.
[pause 0.3s]

This isn't for beginners. This is for people who dream in system prompts. Who have strong opinions about token efficiency.
[pause 0.3s]

Scheduled prompts. Markdown rendering. Drag and drop.
Action links — colored, clickable, nested.
Try mode to debug your prompts. Per-block config. Real-time updates.
If there's an API, MCP, or CLI for it — you can automate it.
[pause 0.5s]

Oh, and there's — dangerously skip permissions.
[pause 0.5s]
Use at your own risk. We are not responsible for what Claude does at 3 AM. Unsupervised.
[pause 0.5s]

And we're just getting started.
Standalone actions. Script mode — let Claude figure it out.
Chat with your blocks. Claude Agent SDK.
Smart reminders. Decks. Notifications. History. Cost tracking. TUI mode.
And the holy grail...
[pause 0.8s]
...the Rust rewrite.
[pause 0.5s]

Things to know: quality of your prompt matters, it runs the claude process under the hood, each block runs in its own folder, there's a try-and-debug mode, permissions need to be set correctly, sandbox mode is available if configured, it can consume tokens like a teenager consumes WiFi, prefer low-frequency updates — once a day, maybe once every few hours — at least until we ship script mode.
[pause 0.3s]

One command. That's it.
[pause 0.5s]
Star it. Fork it. Judge our code.
[pause 0.3s]

Floudeck. Because you have better things to do.
[pause 0.8s]
Actually, you probably don't. But still.
```

---

## Music Generation Prompt

For Suno/Udio or similar:

> Synthwave instrumental, 90 seconds. Starts dark and atmospheric with low pad and rumble (0-12s). Bass drop at 12s, driving beat kicks in at 20s. Energetic and confident through middle section. Brief ominous breakdown at 50s (record scratch energy). Builds to crescendo at 58-70s. Comedic shift to generic corporate hold music at 70-80s. Resolves to clean confident synth chord at 80-88s, fade out. No vocals. 120 BPM.
