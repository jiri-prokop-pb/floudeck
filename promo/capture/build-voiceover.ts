/**
 * Build final voiceover from the full-script WAV.
 *
 * 1. Splits at segment boundaries (from Whisper timestamps)
 * 2. Applies per-segment speedup
 * 3. Inserts silence gaps between segments
 * 4. Concatenates into final voiceover WAV
 *
 * Prerequisites: ffmpeg installed
 *
 * Usage:
 *   bun run promo/capture/build-voiceover.ts
 *   bun run promo/capture/build-voiceover.ts -- --dry-run   # show plan without executing
 */

import { mkdirSync, unlinkSync, writeFileSync } from "node:fs";

const VOICEOVER_DIR = `${import.meta.dir}/../public/voiceover`;
const FULL_SCRIPT = `${VOICEOVER_DIR}/full-script.wav`;
const BUILD_DIR = `${VOICEOVER_DIR}/build`;
const OUTPUT = `${VOICEOVER_DIR}/final-voiceover.wav`;

// Segment boundaries from Whisper word timestamps on full-script.wav (2:40)
// Each segment: [start_seconds, end_seconds]
// Small padding added to avoid cutting mid-word
type SegmentDef = {
  id: string;
  name: string;
  start: number;
  end: number;
  speed: number;
  silenceAfter: number; // seconds of silence to insert after this segment
};

const SEGMENTS: SegmentDef[] = [
  // 01 Cold Open: "You open your laptop..." → "What if your AI already handled it?"
  { id: "01", name: "cold-open", start: 0, end: 13.2, speed: 1.0, silenceAfter: 0.5 },

  // 02 Title Drop: "Flowdeck. Claude Code on autopilot."
  { id: "02", name: "title-drop", start: 13.2, end: 17.0, speed: 1.0, silenceAfter: 0.4 },

  // 03 Problem+Solution: "You love Claude Code..." → "Legal steroids."
  { id: "03", name: "problem-solution", start: 17.0, end: 45.1, speed: 1.3, silenceAfter: 0.4 },

  // 04 Power Users: "This isn't for beginners..." → "token efficiency."
  { id: "04", name: "power-users", start: 45.1, end: 53.5, speed: 1.2, silenceAfter: 0.4 },

  // 05 Features: "Scheduled prompts..." → "you can automate it."
  { id: "05", name: "features", start: 53.5, end: 15.0 + 60, speed: 1.3, silenceAfter: 0.5 },

  // 06 Danger Zone: "Oh, and there's..." → "Unsupervised."
  { id: "06", name: "danger-zone", start: 75.0, end: 86.0, speed: 1.1, silenceAfter: 0.5 },

  // 07 Coming Soon: "And we're just getting started..." → "The Rust rewrite."
  { id: "07", name: "coming-soon", start: 86.0, end: 107.0, speed: 1.3, silenceAfter: 0.4 },

  // 08 Fine Print: "Things to know..." → "ship script mode." (pharmaceutical disclaimer — meant to be fast!)
  { id: "08", name: "fine-print", start: 107.0, end: 130.5, speed: 2.2, silenceAfter: 0.3 },

  // 09 Vibe Coding: "Wait... who built this?" → "it's vibe coding."
  { id: "09", name: "vibe-coding", start: 130.5, end: 145.5, speed: 1.2, silenceAfter: 0.4 },

  // 10 Install CTA: "One command..." → "Judge our code."
  { id: "10", name: "install-cta", start: 145.5, end: 152.0, speed: 1.0, silenceAfter: 0.5 },

  // 11 Outro: "Flowdeck. Because you have better things to do..." → "But still."
  { id: "11", name: "outro", start: 152.0, end: 160.0, speed: 1.0, silenceAfter: 0 },
];

async function run(cmd: string[]): Promise<void> {
  const proc = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`Command failed: ${cmd.join(" ")}\n${stderr.slice(0, 300)}`);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  mkdirSync(BUILD_DIR, { recursive: true });

  // Verify source exists
  const sourceFile = Bun.file(FULL_SCRIPT);
  if (!(await sourceFile.exists())) {
    console.error(`Source not found: ${FULL_SCRIPT}`);
    console.error("Run generate-voiceover.ts first to create full-script.wav");
    process.exit(1);
  }

  console.log("Building voiceover from full-script.wav\n");

  const parts: string[] = [];
  let totalDuration = 0;

  for (const seg of SEGMENTS) {
    const rawFile = `${BUILD_DIR}/${seg.id}-${seg.name}-raw.wav`;
    const speedFile = `${BUILD_DIR}/${seg.id}-${seg.name}.wav`;
    const rawDuration = seg.end - seg.start;
    const outputDuration = rawDuration / seg.speed;

    console.log(
      `  ${seg.id} ${seg.name}: ${rawDuration.toFixed(1)}s → ${outputDuration.toFixed(1)}s (${seg.speed}x)${seg.silenceAfter ? ` + ${seg.silenceAfter}s gap` : ""}`,
    );
    totalDuration += outputDuration + seg.silenceAfter;

    if (dryRun) continue;

    // Step 1: Extract segment from full WAV
    await run([
      "ffmpeg", "-y", "-i", FULL_SCRIPT,
      "-ss", String(seg.start), "-to", String(seg.end),
      "-c", "copy", rawFile,
    ]);

    // Step 2: Apply speed adjustment
    if (seg.speed === 1.0) {
      // No speedup needed, just rename
      await run(["cp", rawFile, speedFile]);
    } else {
      // For atempo, values must be between 0.5 and 100.0
      // For speeds > 2.0, chain multiple atempo filters
      const filters = buildAtempoFilter(seg.speed);
      await run([
        "ffmpeg", "-y", "-i", rawFile,
        "-filter:a", filters,
        speedFile,
      ]);
    }

    parts.push(speedFile);

    // Step 3: Add silence gap
    if (seg.silenceAfter > 0) {
      const silenceFile = `${BUILD_DIR}/${seg.id}-silence.wav`;
      await run([
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", `anullsrc=r=24000:cl=mono`,
        "-t", String(seg.silenceAfter),
        silenceFile,
      ]);
      parts.push(silenceFile);
    }
  }

  console.log(`\n  Total estimated duration: ${formatTime(totalDuration)}`);

  if (dryRun) return;

  // Step 4: Concatenate all parts
  const listFile = `${BUILD_DIR}/concat-list.txt`;
  const listContent = parts.map((p) => `file '${p}'`).join("\n");
  writeFileSync(listFile, listContent);

  await run([
    "ffmpeg", "-y", "-f", "concat", "-safe", "0",
    "-i", listFile,
    "-c", "copy",
    OUTPUT,
  ]);

  // Get actual duration
  const proc = Bun.spawn(
    ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", OUTPUT],
    { stdout: "pipe" },
  );
  const duration = parseFloat(await new Response(proc.stdout).text());
  console.log(`\nFinal voiceover: ${formatTime(duration)} -> ${OUTPUT}`);
}

function buildAtempoFilter(speed: number): string {
  // atempo accepts 0.5 to 100.0, but for quality, chain at max 2.0 per step
  const parts: string[] = [];
  let remaining = speed;
  while (remaining > 2.0) {
    parts.push("atempo=2.0");
    remaining /= 2.0;
  }
  parts.push(`atempo=${remaining.toFixed(4)}`);
  return parts.join(",");
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  return `${m}:${s.padStart(4, "0")}`;
}

main().catch((err) => {
  console.error("Fatal:", err.message ?? err);
  process.exit(1);
});
