/**
 * Generate all voiceover segments for the promo video using Kyutai Pocket TTS.
 *
 * Each segment is broken into small chunks for better quality.
 * Chunks within a segment are saved as separate WAV files for Remotion to sequence.
 *
 * Prerequisites:
 *   - `uv` installed (brew install uv)
 *   - HuggingFace token at ~/.cache/huggingface/token
 *   - Accepted terms at https://huggingface.co/kyutai/pocket-tts
 *
 * Usage:
 *   bun run promo/capture/generate-voiceover.ts
 *   bun run promo/capture/generate-voiceover.ts -- --segment 1   # generate only segment 1
 *   bun run promo/capture/generate-voiceover.ts -- --dry-run      # print segments without generating
 */

const OUTPUT_DIR = `${import.meta.dir}/../public/voiceover`;
const VOICE = "hf://kyutai/tts-voices/voice-zero/stuart_bell.wav";

type Chunk = { text: string };

type Segment = {
  id: string;
  name: string;
  chunks: Chunk[];
};

const SEGMENTS: Segment[] = [
  {
    id: "01",
    name: "cold-open",
    chunks: [
      { text: "You open your laptop. 47 Slack messages. 12 PRs to review. 3 incidents. And it's only Monday." },
      { text: "What if your AI already handled it?" },
    ],
  },
  {
    id: "02",
    name: "title-drop",
    chunks: [
      { text: "Flowdeck. Claude Code — on autopilot." },
    ],
  },
  {
    id: "03",
    name: "problem-solution",
    chunks: [
      { text: "You love Claude Code. You use it every day. But you're tired of asking the same things. Over. And over. And over." },
      { text: "Flowdeck runs your prompts on a schedule, renders the output in a beautiful markdown feed. One glance — and you know everything." },
      { text: "Like Claude Code's loop mode... but on steroids. Legal steroids." },
    ],
  },
  {
    id: "04",
    name: "power-users",
    chunks: [
      { text: "This isn't for beginners. This is for people who dream in system prompts. Who have strong opinions about token efficiency." },
    ],
  },
  {
    id: "05",
    name: "features",
    chunks: [
      { text: "Scheduled prompts. Markdown rendering. Drag and drop. Action links — colored, clickable, nested." },
      { text: "Try mode to debug your prompts. Per-block config. Real-time updates. If there's an API, MCP, or CLI for it — you can automate it." },
    ],
  },
  {
    id: "06",
    name: "danger-zone",
    chunks: [
      { text: "Oh, and there's — dangerously skip permissions." },
      { text: "Use at your own risk. We are not responsible for what Claude does at 3 AM. Unsupervised." },
    ],
  },
  {
    id: "07",
    name: "coming-soon",
    chunks: [
      { text: "And we're just getting started. Standalone actions. Script mode — let Claude figure it out. Chat with your blocks. Claude Agent SDK." },
      { text: "Reminders. Decks. Notifications. Cost tracking. TUI mode." },
      { text: "And the holy grail... the Rust rewrite." },
    ],
  },
  {
    id: "08",
    name: "fine-print",
    chunks: [
      { text: "Things to know: quality of your prompt matters, it runs the claude process under the hood, each block runs in its own folder," },
      { text: "there's try-and-debug mode, permissions need to be set correctly, sandbox mode available," },
      { text: "it can consume tokens like a teenager consumes WiFi, prefer low-frequency updates — at least until we ship script mode." },
    ],
  },
  {
    id: "09",
    name: "vibe-coding",
    chunks: [
      { text: "Wait... who built this? One person. Claude Code. And mass amounts of mass amounts of prompts and tokens." },
      { text: "They call it vibe-coding. We call it... the future. Okay fine, it's vibe-coding." },
    ],
  },
  {
    id: "10",
    name: "install-cta",
    chunks: [
      { text: "One command. That's it. Star it. Fork it. Judge our code." },
    ],
  },
  {
    id: "11",
    name: "outro",
    chunks: [
      { text: "Flowdeck. Because you have better things to do. Actually, you probably don't. But still." },
    ],
  },
];

async function generate(text: string, outputPath: string): Promise<{ ok: boolean; sizeKb: number }> {
  const proc = Bun.spawn([
    "uvx", "pocket-tts", "generate",
    "--text", text,
    "--voice", VOICE,
    "--output-path", outputPath,
    "--quiet",
  ], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(stderr.split("\n").filter(Boolean).pop() ?? `exit code ${exitCode}`);
  }

  const file = Bun.file(outputPath);
  const sizeKb = Math.round((await file.size) / 1024);
  return { ok: true, sizeKb };
}

async function main() {
  const args = process.argv.slice(2);
  const segmentFilter = getArg(args, "--segment");
  const dryRun = args.includes("--dry-run");

  console.log(`Voice: ${VOICE}`);
  console.log(`Engine: Kyutai Pocket TTS (via uvx)\n`);

  const segments = segmentFilter
    ? SEGMENTS.filter((s) => s.id === segmentFilter.padStart(2, "0"))
    : SEGMENTS;

  if (segments.length === 0) {
    console.error(`No segment matching "${segmentFilter}"`);
    process.exit(1);
  }

  // Ensure output dir
  const { mkdirSync } = await import("node:fs");
  mkdirSync(OUTPUT_DIR, { recursive: true });

  let generated = 0;
  let failed = 0;

  for (const segment of segments) {
    console.log(`\n--- ${segment.id}. ${segment.name} (${segment.chunks.length} chunks) ---`);

    for (let i = 0; i < segment.chunks.length; i++) {
      const chunk = segment.chunks[i];
      const suffix = segment.chunks.length > 1 ? String.fromCharCode(97 + i) : "";
      const filename = `${segment.id}-${segment.name}${suffix}.wav`;
      const filepath = `${OUTPUT_DIR}/${filename}`;

      if (dryRun) {
        console.log(`  [${suffix || "0"}] ${filename}`);
        console.log(`      "${chunk.text.slice(0, 80)}..."`);
        continue;
      }

      process.stdout.write(`  ${filename} ... `);

      try {
        const { sizeKb } = await generate(chunk.text, filepath);
        console.log(`${sizeKb}KB`);
        generated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`FAILED: ${msg.slice(0, 150)}`);
        failed++;
      }
    }
  }

  if (!dryRun) {
    console.log(`\nDone: ${generated} generated, ${failed} failed -> ${OUTPUT_DIR}/`);
  }
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
