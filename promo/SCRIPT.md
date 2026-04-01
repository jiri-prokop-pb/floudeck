# Floudeck Promo Video — Production Script

**Total duration:** ~2:10 | **Resolution:** 1920x1080 | **FPS:** 30 | **Total frames:** ~3798

---

## Audio Plan

### Voiceover (Kyutai Pocket TTS)

- **Voice:** Stuart Bell (`hf://kyutai/tts-voices/voice-zero/stuart_bell.wav`). Deep, confident male narrator.
- **Engine:** `uvx pocket-tts generate` (local, free). Requires HF auth + accepted terms at huggingface.co/kyutai/pocket-tts.
- **Style:** Slightly dramatic, knows it's a bit ridiculous and leans into it.
- **Pacing:** Varies — slow/dramatic for cold open, rapid-fire for features, whisper for danger zone, fast-talk for caveats (achieved via variable `atempo` speedup in post-processing).

### Music

- **Genre:** Synthwave / retro-futuristic (80s synth, modern production)
- **Arc:**
  - 0:00–0:12 — Dark, atmospheric pad. Low rumble.
  - 0:12–0:20 — Bass drop on title reveal, energy builds.
  - 0:20–0:50 — Driving beat, confident. Think "montage energy."
  - 0:50–0:58 — Record scratch → ominous synth for danger zone.
  - 0:58–1:08 — Hype energy crescendo for "coming soon" features.
  - 1:08–1:16 — Sudden shift to pharmaceutical-ad muzak for caveats.
  - 1:16–1:22 — Warm, sincere beat for vibe-coding reveal.
  - 1:22–1:30 — Clean, confident resolution for install/CTA/outro.

### Sound Effects

| Timestamp | SFX | Notes |
|-----------|-----|-------|
| 0:12 | Bass hit / impact | Title slam |
| 0:50 | Record scratch | Transition to danger zone |
| 0:52 | Explosion / fire woosh | `--dangerously-skip-permissions` |
| 1:01 | Angelic choir + shimmer | "Rust Rewrite" mention |
| 1:08 | Rapid whoosh (x6) | Caveat text flying in |

---

## Segments

---

### 1. COLD OPEN — 0:00–0:14 (13.8s, 414 frames)

**Voiceover:**
> You open your laptop. 47 Slack messages. 12 PRs to review. 3 incidents.
> And it's only Monday.
> *(beat)*
> What if your morning briefing was already there?

**Visuals:** Full-screen background image (`monday-scene.png`) fades in over first second at 75% opacity. No typewriter text or pain points on screen. "What if your morning briefing was already there?" fades in with indigo glow at ~10.6s.

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
- 0:22–0:32: **[Playwright capture]** — Main feed with 3-4 blocks, rich markdown output visible. Slow scroll through the feed. Captured via automated Playwright script with demo data.

**Music:** Beat kicks in at 0:22, driving and confident.

---

### 4. FOR POWER USERS — 0:32–0:38 (6s, 180 frames)

**Voiceover:**
> This isn't for beginners. This is for people who dream in system prompts.
> Who have strong opinions about token efficiency.

**Visuals:** Green-on-black terminal showing actual Claude CLI commands typing out: `$ claude`, `> /context add "morning briefing"`, `> /insights --since yesterday`. Bridge text "Here's what it can do for you." fades in at bottom before scene fade-out.

**Music:** Steady driving beat continues.

---

### 5. FEATURES SHOWCASE — 0:38–0:50 (12s, 360 frames)

**Voiceover:**
> Scheduled prompts. Markdown rendering. Drag and drop.
> Action links — colored, clickable, nested.
> Try mode to debug your prompts. Per-block config. Real-time updates.
> If there's an API, MCP, or CLI for it — you can automate it.

**Visuals:** Rapid feature cards (~2.8s each), full-screen screenshots on dark background with title overlay strip at bottom. Last card (API/MCP/CLI) uses white background with centered animated checkmarks. Cards spring in from right, exit to left:
- Scheduled prompts (form screenshot)
- Markdown + Action links (block card screenshot)
- Try mode (try mode screenshot)
- Per-block config (settings screenshot)
- Real-time updates (feed screenshot)
- API? MCP? CLI? (animated checkmarks, white background)

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
- 0:54–0:58: **[JIRI: "This is Fine" meme]** (`promo/public/this-is-fine.png`) fades in behind the text. Dog = "your codebase", fire = "Claude with skip-permissions at 3 AM". Slight zoom + screen shake in Remotion.
- Small disclaimer text at bottom: "Seriously though. Set your permissions correctly."

**Music:** Ominous synth, single piano notes. Fire/explosion SFX.

---

### 7. COMING SOON — 0:58–1:08 (10s, 300 frames)

**Voiceover:**
> And we're just getting started.
> Standalone actions. Script mode — let Claude figure it out.
> Chat with your blocks. Claude Agent SDK.
> Reminders. Decks. Notifications. Cost tracking. TUI mode.
> And the holy grail...
> *(reverent whisper)* ...the Rust rewrite.

**Visuals:** Each feature name flies in from different directions, stacking into a grid. Fast-paced, hype energy. On "Rust rewrite" — everything pauses, angelic light rays burst from the text, subtle lens flare, choir SFX.

**Music:** Building crescendo, peaks at "Rust rewrite" with choir hit.

---

### 8. THE FINE PRINT — 1:08–1:16 (8s, 240 frames)

**Voiceover (fast-talk, pharmaceutical disclaimer style):**
> Things to know: quality of your prompt matters, it runs the claude process under the hood, each block runs in its own folder, there's try-and-debug mode, permissions need to be set correctly, sandbox mode available, it can consume tokens like a teenager consumes WiFi, prefer low-frequency updates — at least until we ship script mode.

**Visuals:** Rapid-scrolling disclaimer text at the bottom of screen (classic pharmaceutical ad style). Above the scrolling text, a clean centered title: "The Fine Print™". Text auto-generated in Remotion — each line flies in, scrolls up, and exits. No external assets needed.

**Music:** Suddenly switches to generic corporate hold music / pharmaceutical ad muzak. Comedic contrast.

---

### 9. VIBE-CODING REVEAL — 1:16–1:22 (6s, 180 frames)

**Voiceover:**
> Wait... who built this?
> One person. Claude Code. And mass amounts of mass amounts of prompts and tokens.
> They call it vibe-coding. We call it... the future.
> *(beat)*
> Okay fine, it's vibe-coding.

**Visuals:**
- 1:16–1:18: Text: "Wait... who built this?" types in, curious tone.
- 1:18–1:22: **[JIRI: AI-generated "vibe-coding" photo]** slides in from the side. Holds for ~3 seconds with a subtle slow zoom (Ken Burns effect). Small text caption fades in below: "The entire engineering department."

**Music:** Warm, slightly emotional synth. The "sincere" moment of the video.

---

### 10. INSTALL + CTA — 1:22–1:27 (5s, 150 frames)

**Voiceover:**
> One command. That's it.
> Star it. Fork it. Judge our code.

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

### 11. OUTRO — 1:27–1:30 (3s, 90 frames)

**Voiceover:**
> Floudeck. Because you have better things to do.
> *(beat)*
> Actually, you probably don't. But still.

**Visuals:** Logo centered, tagline below. Fade to black.

**Music:** Final synth chord, fade out.

---

## Voiceover Script (clean)

Full script text. Pause markers noted as `[pause]`.

```
You open your laptop. 47 Slack messages. 12 PRs to review. 3 incidents.
And it's only Monday.
[pause 1.5s]
What if your morning briefing was already there?
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
Reminders. Decks. Notifications. Cost tracking. TUI mode.
And the holy grail...
[pause 0.8s]
...the Rust rewrite.
[pause 0.5s]

Things to know: quality of your prompt matters, it runs the claude process under the hood, each block runs in its own folder, there's try-and-debug mode, permissions need to be set correctly, sandbox mode available, it can consume tokens like a teenager consumes WiFi, prefer low-frequency updates — at least until we ship script mode.
[pause 0.3s]

Wait... who built this?
One person. Claude Code. And mass amounts of mass amounts of prompts and tokens.
They call it vibe-coding. We call it... the future.
[pause 0.5s]
Okay fine, it's vibe-coding.
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

## Image Generation Prompts

### Asset 1: "Vibe-coding" photo

Use this prompt in Midjourney, DALL-E, or your preferred image generator. Adjust the person's appearance to match yourself.

> A dramatic cinematic photo of a solo developer sitting at a sleek desk with a laptop, bathed in the purple-blue glow of multiple monitors showing code and terminal windows. The atmosphere is intense and focused, like a movie hacker scene. Floating holographic UI elements and code snippets surround them. The room is dark except for the screen glow. On one screen, a chat interface with an AI is clearly visible. The mood is "one person against the world, armed with nothing but prompts." Photorealistic, wide angle, dramatic lighting, 16:9 aspect ratio.

Adjust to make it look like you. Add humor elements if you want (e.g., absurd number of terminal windows, a whiteboard behind with "TODO: sleep" crossed out, post-it notes everywhere saying things like "one more prompt").

### Asset 2: "This is Fine" meme

> The classic "This is Fine" meme (cartoon dog sitting at a table in a burning room, saying "This is fine"), but modified: the dog is wearing headphones and has a laptop open, the laptop screen shows a terminal with the text "--dangerously-skip-permissions". The flames around the room are labeled with small floating text: "3 AM deploys", "unsupervised Claude", "yolo mode". The dog is labeled "your codebase". Cartoon style matching the original meme. 16:9 aspect ratio.

If the generator struggles with the original meme style, you can also try: find/use the original meme template and edit labels onto it in any image editor.

---

## Music Generation Guide

### Platform choice: Use Suno (not Udio)

Neither platform supports exact timestamp control, but Suno has section tags that give approximate structural control. Udio has better audio fidelity but almost no structure control.

### Recommended approach: 3-segment stitch

Generate 3 separate segments and stitch in Remotion (or a DAW like Audacity/Logic). This gives exact timestamp control for mood transitions.

**Segment A — "Dark Intro + Driving Beat" (~50s)**
```
Style: cinematic electronic, synthwave, dark, instrumental, 120 BPM
[Intro: dark atmospheric pad, low rumble, mysterious, 12 seconds]
[Drop: bass hit impact, synth bass, energy rises]
[Main: driving confident synth beat, energetic montage music, steady groove]
[Break: sudden stop, ominous single piano notes, eerie, 8 seconds]
```

**Segment B — "Hype + Corporate Muzak" (~22s)**
```
Style: electronic, synthwave, instrumental, 120 BPM
[Build: rising hype energy, cinematic synth crescendo, triumphant]
[Switch: generic corporate hold music, cheesy, pharmaceutical ad muzak, comedic contrast]
[Warm: sincere, emotional synth pad, reflective, brief]
```

**Segment C — "Clean Outro" (~18s)**
```
Style: synthwave, clean, confident, instrumental, 120 BPM
[Resolution: clean confident synth chord, satisfying, professional]
[Fade: ambient pad, gentle fade out, 3 seconds]
```

### Alternative: single generation (faster, less control)

If stitching feels like too much work, try generating the full thing in one shot. Generate 5-10 variants and pick the best one:

```
Style: cinematic synthwave instrumental, dynamic, varied moods, 120 BPM

[Intro: dark ambient drone, mysterious, atmospheric, 12 seconds]
[Drop: bass impact, energy builds, synth bass enters]
[Main: driving confident beat, montage energy, steady groove]
[Break: record scratch, ominous piano, eerie quiet, 8 seconds]
[Build: rising hype crescendo, triumphant, features flying in]
[Shift: suddenly corporate hold music, cheesy pharmaceutical ad, comedic]
[Warm: sincere emotional synth, brief reflective moment]
[Outro: clean confident resolution chord, professional, fade out]
```

**Timing won't be exact** — Suno interprets section durations loosely. Pick the variant where mood shifts land closest to the video timing, then trim in post.

### Post-processing tips

- Trim/stretch sections in Audacity or a DAW to hit exact timestamps
- Add 0.5s crossfades between stitched segments
- Normalize volume levels across segments
- In Remotion, we can also duck the music volume under voiceover sections
