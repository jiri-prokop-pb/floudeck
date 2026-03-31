/**
 * Test voiceover lines against Voicebox.sh engines/profiles.
 *
 * Prerequisites:
 *   1. Voicebox.sh running locally (API at localhost:17493)
 *   2. At least one voice profile created in Voicebox
 *
 * Usage:
 *   bun run promo:voice-test                    # test all lines with all profiles (default engine)
 *   bun run promo:voice-test -- --profile "Dave" # test with specific profile
 *   bun run promo:voice-test -- --line 0         # test only the first line
 *   bun run promo:voice-test -- --engine qwen    # use specific engine (qwen, luxtts, chatterbox, chatterbox_turbo, tada, kokoro)
 *   bun run promo:voice-test -- --instruct "speak slowly and dramatically"  # delivery instructions (qwen engine only)
 */

const API = "http://localhost:17493";
const OUTPUT_DIR = `${import.meta.dir}/../public/voiceover-tests`;

// Voicebox engine IDs
const ENGINES = [
  "qwen",
  "luxtts",
  "chatterbox",
  "chatterbox_turbo",
  "tada",
  "kokoro",
] as const;

// Representative lines from each segment — different tones/pacing
const TEST_LINES = [
  {
    id: "cold-open",
    text: "You open your laptop. 47 Slack messages. 12 PRs to review. 3 incidents. And it's only Monday.",
    instruct: "Speak slowly and dramatically, like a movie trailer narrator. Pause between each item.",
  },
  {
    id: "title-drop",
    text: "Floudeck. Claude Code — on autopilot.",
    instruct: "Confident and punchy. Short pause after 'Floudeck'. This is the big reveal.",
  },
  {
    id: "steroids",
    text: "Like Claude Code's loop mode... but on steroids. Legal steroids.",
    instruct: "Self-aware humor, like you know it's a bit ridiculous. Slight smirk energy.",
  },
  {
    id: "power-users",
    text: "This isn't for beginners. This is for people who dream in system prompts. Who have strong opinions about token efficiency.",
    instruct: "Deadpan, matter-of-fact delivery. Dry humor.",
  },
  {
    id: "danger-zone",
    text: "Use at your own risk. We are not responsible for what Claude does at 3 AM. Unsupervised.",
    instruct: "Drop to a whisper. Conspiratorial, dramatic, like sharing a dangerous secret.",
  },
  {
    id: "rust-rewrite",
    text: "And the holy grail... the Rust rewrite.",
    instruct: "Reverent whisper, full of awe. Long pause before 'the Rust rewrite'. Almost religious.",
  },
  {
    id: "fine-print",
    text: "Things to know: quality of your prompt matters, it runs the claude process under the hood, each block runs in its own folder, there's try-and-debug mode, permissions need to be set correctly, sandbox mode available, it can consume tokens like a teenager consumes WiFi, prefer low-frequency updates — at least until we ship script mode.",
    instruct: "Speak very fast, like a pharmaceutical disclaimer at the end of a TV ad. Rapid-fire, barely breathing.",
  },
  {
    id: "vibe-coding",
    text: "One person. Claude Code. And mass amounts of mass amounts of prompts and tokens. They call it vibe-coding. We call it... the future. Okay fine, it's vibe-coding.",
    instruct: "Start warm and sincere. Build up. Then self-deprecating and funny at 'okay fine'.",
  },
  {
    id: "outro",
    text: "Floudeck. Because you have better things to do. Actually, you probably don't. But still.",
    instruct: "Confident start, then deadpan humor on 'actually you probably don't'. End with a shrug.",
  },
];

type Profile = {
  id: string;
  name: string;
  default_engine: string | null;
};

async function getProfiles(): Promise<Profile[]> {
  const res = await fetch(`${API}/profiles`);
  if (!res.ok) throw new Error(`Failed to fetch profiles: ${res.status}`);
  return res.json();
}

async function generate(
  text: string,
  profileId: string,
  engine: string,
  instruct?: string,
): Promise<ArrayBuffer> {
  const body: Record<string, unknown> = {
    text,
    profile_id: profileId,
    engine,
    language: "en",
    normalize: true,
  };
  if (instruct && engine.startsWith("qwen")) {
    body.instruct = instruct;
  }
  const res = await fetch(`${API}/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Generate failed (${res.status}): ${errBody.slice(0, 200)}`);
  }
  return res.arrayBuffer();
}

async function main() {
  const args = process.argv.slice(2);
  const profileFilter = getArg(args, "--profile");
  const lineFilter = getArg(args, "--line");
  const engineFilter = getArg(args, "--engine");
  const instructOverride = getArg(args, "--instruct");

  // Check Voicebox is running
  try {
    await fetch(`${API}/profiles`);
  } catch {
    console.error(
      "Cannot reach Voicebox API at localhost:17493. Is Voicebox.sh running?",
    );
    process.exit(1);
  }

  const profiles = await getProfiles();
  if (profiles.length === 0) {
    console.error(
      "No voice profiles found. Create at least one profile in Voicebox first.",
    );
    process.exit(1);
  }

  // Filter profiles
  const selectedProfiles = profileFilter
    ? profiles.filter((p) =>
        p.name.toLowerCase().includes(profileFilter.toLowerCase()),
      )
    : profiles;

  if (selectedProfiles.length === 0) {
    console.error(`No profiles matching "${profileFilter}"`);
    console.log("Available profiles:", profiles.map((p) => p.name).join(", "));
    process.exit(1);
  }

  // Engine selection: explicit flag, or profile default, or "qwen"
  const engineFromFlag = engineFilter
    ? ENGINES.find((e) => e.includes(engineFilter.toLowerCase()))
    : undefined;

  // Filter lines
  const selectedLines =
    lineFilter !== undefined
      ? [TEST_LINES[Number(lineFilter)]].filter(Boolean)
      : TEST_LINES;

  if (selectedLines.length === 0) {
    console.error(`Invalid line index: ${lineFilter}. Valid: 0-${TEST_LINES.length - 1}`);
    process.exit(1);
  }

  // Ensure output dir
  await Bun.write(`${OUTPUT_DIR}/.gitkeep`, "");

  console.log(`\nProfiles: ${selectedProfiles.map((p) => p.name).join(", ")}`);
  console.log(`Engine: ${engineFromFlag ?? "profile default"}`);
  console.log(`Lines: ${selectedLines.length}\n`);

  let generated = 0;
  let failed = 0;

  for (const profile of selectedProfiles) {
    const engine =
      engineFromFlag ?? profile.default_engine ?? "qwen";

    for (const line of selectedLines) {
      const instruct = instructOverride ?? line.instruct;
      const filename = `${line.id}__${sanitize(profile.name)}__${engine}.wav`;
      const filepath = `${OUTPUT_DIR}/${filename}`;

      process.stdout.write(
        `  ${line.id} / ${profile.name} / ${engine} ... `,
      );

      try {
        const audio = await generate(line.text, profile.id, engine, instruct);
        await Bun.write(filepath, audio);
        const sizeKb = Math.round(audio.byteLength / 1024);
        console.log(`${sizeKb}KB -> ${filename}`);
        generated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`FAILED: ${msg.slice(0, 120)}`);
        failed++;
      }
    }
  }

  console.log(
    `\nDone: ${generated} generated, ${failed} failed -> ${OUTPUT_DIR}/`,
  );
}

function getArg(args: string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function sanitize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
