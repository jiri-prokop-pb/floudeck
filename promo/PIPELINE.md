# Promo Video Pipeline

Automated pipeline for generating Floudeck promo videos using Remotion, local TTS, and programmatic captures. Goal: regenerate videos on each release to showcase current features and roadmap. macOS-only for now.

## Current state

The pipeline is **partially automated**. Rendering and UI captures are scripted. Voiceover generation, SFX sourcing, and music are manual steps with tooling scaffolded.

| Step | Status | Automation |
|------|--------|------------|
| Script | Manual | `promo/SCRIPT.md` — defines segments, visuals, voiceover text |
| UI captures | Automated | `bun run capture` — Playwright captures to `promo/public/captures/` |
| Voiceover | Semi-auto | `generate-voiceover.ts` generates WAVs, `build-voiceover.ts` splits/speeds, manual normalize step |
| SFX | Manual | CC0 WAVs from Freesound in `promo/public/sfx/` |
| Music | Manual | Gemini-generated synthwave at `promo/public/music.mp3` |
| Remotion scenes | Manual | 11 scenes in `promo/src/scenes/`, durations in `constants.ts` |
| Render | Automated | `bun run render` → `promo/out/promo.mp4` |

### Commands

```bash
cd promo
bun run studio           # open Remotion studio for preview
bun run render           # render final MP4 to promo/out/promo.mp4
bun run capture          # capture UI screenshots via Playwright
bun run pipeline         # capture + render (end-to-end)
```

### Voiceover tooling

```bash
# Generate all segments (or --segment N for one)
bun run promo/capture/generate-voiceover.ts
bun run promo/capture/generate-voiceover.ts -- --segment 1

# Split full-script.wav at Whisper boundaries, apply speedup
bun run promo/capture/build-voiceover.ts
bun run promo/capture/build-voiceover.ts -- --dry-run

# Normalize volume (manual, per file)
ffmpeg -y -i input.wav -af "loudnorm=I=-16:TP=-1:LRA=11" output.wav
```

## Prerequisites (macOS)

- **Bun** — runtime for all scripts
- **ffmpeg / ffprobe** — audio processing (`brew install ffmpeg`)
- **uv** — Python package runner for TTS (`brew install uv`)
- **HuggingFace auth** — token at `~/.cache/huggingface/token`, accepted terms at [huggingface.co/kyutai/pocket-tts](https://huggingface.co/kyutai/pocket-tts)
- **Playwright** — for UI captures (`bunx playwright install chromium`)
- **Whisper** (optional) — for word-level timestamps when splitting full-script WAVs (`uvx mlx_whisper`)

## Architecture

```
promo/
├── SCRIPT.md                    # production script (segments, visuals, VO text)
├── PIPELINE.md                  # this file
├── package.json                 # Remotion deps + scripts
├── src/
│   ├── Root.tsx                 # Remotion composition registration
│   ├── Promo.tsx                # main composition — sequences scenes + audio
│   ├── constants.ts             # segment durations, colors, typography
│   └── scenes/                  # one component per segment (11 total)
│       ├── ColdOpenScene.tsx
│       ├── TitleDropScene.tsx
│       ├── ProblemSolutionScene.tsx
│       ├── PowerUsersScene.tsx
│       ├── FeaturesScene.tsx
│       ├── DangerZoneScene.tsx
│       ├── ComingSoonScene.tsx
│       ├── FinePrintScene.tsx
│       ├── VibeCodingScene.tsx
│       ├── InstallCtaScene.tsx
│       └── OutroScene.tsx
├── capture/
│   ├── scenarios.ts             # Playwright capture scripts
│   ├── capture-server.ts        # temp server with demo data
│   ├── demo-data.ts             # mock blocks for captures
│   ├── generate-voiceover.ts    # Pocket TTS generation (per-segment chunks)
│   ├── build-voiceover.ts       # split + speed + concat from full-script WAV
│   └── test-voiceover.ts        # quick TTS test
├── public/
│   ├── captures/                # Playwright screenshots (auto-generated)
│   ├── voiceover/               # 11 segment WAVs + full-script.wav
│   ├── sfx/                     # sound effects (CC0)
│   ├── music.mp3                # background music track
│   ├── logo.png                 # Floudeck logo
│   ├── monday-scene.png         # cold open background
│   ├── vibecoding.png           # vibe-coding scene photo
│   └── this-is-fine.png         # danger zone meme
└── out/                         # rendered output (gitignored)
```

## Voiceover details

- **Engine:** Kyutai Pocket TTS (local, free) via `uvx pocket-tts generate`
- **Voice:** Stuart Bell — `hf://kyutai/tts-voices/voice-zero/stuart_bell.wav`
- **Note:** voiceover says "Flowdeck" (not "Floudeck") — intentional branding pronunciation
- **Script text** lives in `generate-voiceover.ts` SEGMENTS array (chunked for quality)
- **Speed adjustments** in `build-voiceover.ts` — 1.0x for short, 1.2–1.3x for medium, 2.2x for fine-print comedy effect
- **Volume normalization:** EBU R128 broadcast loudness (`loudnorm=I=-16:TP=-1:LRA=11`)

### Two generation approaches

**Approach A — Full script (current):** Generate entire script as one WAV, transcribe with Whisper for word timestamps, split at segment boundaries, apply per-segment speedup. Best for consistent voice continuity.

**Approach B — Per-segment:** Generate each segment independently. Faster iteration but may have slight voice inconsistencies between segments. Good for re-recording a single segment.

## SFX

5 CC0 effects from [Freesound](https://freesound.org/) in `promo/public/sfx/`:

| File | Use | Source |
|------|-----|--------|
| `bass-hit.wav` | Title drop impact | Freesound CC0 |
| `record-scratch.wav` | Danger zone transition | Freesound CC0 |
| `explosion-boom.wav` | --dangerously-skip-permissions | Freesound CC0 |
| `angelic-choir.wav` | Rust Rewrite reveal | Freesound CC0 |
| `whoosh.wav` | Fine print lines flying in | Freesound CC0 |

Post-processing applied: trimmed silence, normalized with `loudnorm` + `alimiter`.

## Music

- **Track:** synthwave / retro-futuristic, ~2:26
- **Source:** Gemini-generated (manual)
- **File:** `promo/public/music.mp3`
- **In Remotion:** ducked to 15% under voiceover, fades in/out at start/end

## UI captures

Playwright scripts capture screenshots of Floudeck running with demo data:

1. `capture-server.ts` starts a temp server with mock blocks from `demo-data.ts`
2. `scenarios.ts` drives Playwright to capture specific UI states (feed, forms, settings, etc.)
3. Screenshots saved to `promo/public/captures/` (10 PNGs currently)

---

## Full automation TODO

Goal: `bun run promo:generate` regenerates the entire video from script to MP4.

### Phase 1 — Unify voiceover pipeline

- [ ] Combine `generate-voiceover.ts` and `build-voiceover.ts` into a single `bun run promo:voiceover` command
- [ ] Auto-normalize each segment after generation (integrate ffmpeg `loudnorm` into the script)
- [ ] Auto-detect segment durations from WAV files and update `constants.ts` programmatically
- [ ] Remove dependency on Whisper for segment splitting — generate segments individually (Approach B) instead of splitting a full-script WAV
- [ ] Add `--voice` flag to switch TTS voice without editing code

### Phase 2 — SFX generation

Currently manual (Freesound downloads). For full automation, two viable approaches for local macOS generation:

**Option A — Stable Audio Open Small (recommended)**
- 341M params, Arm CPU optimized, runs on M-series in seconds
- Stability AI Community License (commercial allowed under conditions)
- Gated model on HuggingFace (one-time terms acceptance)
- Install: `pip install stable-audio-tools` + PyTorch MPS
- Good for: short foley, impacts, textures, whooshes

**Option B — Audio-MAGNeT small (AudioCraft)**
- 300M params, 10s sound effects
- **CC-BY-NC license** (non-commercial only) — blocker for commercial use
- Install: `pip install audiocraft`
- Good for: discrete event SFX, foley

**Recommended approach:** Use Stable Audio Open Small for generation. Each SFX prompt goes in the script definition. Generated effects get trimmed + normalized automatically. Keep a curated fallback library of CC0 effects from Freesound for cases where generation quality is insufficient.

- [ ] Create `promo/capture/generate-sfx.ts` — text-to-SFX via Stable Audio Open Small
- [ ] Define SFX prompts in script config (e.g., `{ name: "bass-hit", prompt: "Deep bass impact hit, clean, cinematic, short" }`)
- [ ] Auto-trim silence and normalize generated effects
- [ ] Fallback: check if a manually curated WAV exists before generating

### Phase 3 — Music

Music is the hardest to automate locally with quality. Current approach (Gemini-generated, manually selected) works well.

**For automation:**
- [ ] Integrate with Suno API or similar service for music generation from style prompts
- [ ] Alternative: use Stable Audio Open 1.0 (4.85GB model) for ambient/textural music — viable for background tracks but less musical structure than Suno
- [ ] Music prompt lives in script config alongside segment timing hints
- [ ] For now: keep manual music selection, add a `--skip-music` flag to the pipeline

### Phase 4 — Script-driven generation

All content defined in a single structured script file:

- [ ] Create `promo/script.ts` — typed script definition (segments, VO text, visuals, SFX prompts, timing)
- [ ] Scene components read from script config, not hardcoded text
- [ ] `constants.ts` auto-generated from WAV durations after voiceover step
- [ ] Remotion scenes become generic templates parametrized by script data
- [ ] Support "short" video variant — subset of segments for feature announcements

### Phase 5 — One-command pipeline

```bash
bun run promo:generate              # full pipeline: captures → VO → SFX → render
bun run promo:generate --short      # short video (new features only)
bun run promo:generate --skip-music # keep existing music.mp3
bun run promo:generate --segment 5  # re-render single segment for preview
```

- [ ] Orchestrate: captures → voiceover → SFX → duration calc → render
- [ ] Integrate into release workflow (optional step)
- [ ] Cache unchanged assets (skip regeneration if script text hasn't changed)

### Image assets

Static images (`monday-scene.png`, `vibecoding.png`, `this-is-fine.png`, `logo.png`) are manual / AI-generated. No automation planned — they change rarely and need human judgment. Generation prompts are in `SCRIPT.md`.
