import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT_MONO, FONT_SANS, TEXT_MUTED, TEXT_PRIMARY } from "../constants";

// Timing from silence detection on 03-problem-solution.wav
const OVER1_FRAME = 177; // 5.9s — "Over."
const OVER2_FRAME = 204; // 6.8s — "And over."
const OVER3_FRAME = 234; // 7.8s — "And over."
const OVER4_FRAME = 268; // 8.93s — "And over."
const FEED_START = 306; // 10.2s — "Floudeck runs your prompts on a schedule"

// Repeating prompt animation for the "dead space" before "Over."
// VO says "you're tired of asking the same things" — we show it visually
const PROMPT_TEXT = "Summarize today's PRs and incidents";
const PROMPT_CYCLES = [
  { start: 15, typeDuration: 60 }, // slow first time
  { start: 80, typeDuration: 40 }, // faster
  { start: 125, typeDuration: 25 }, // fastest — frustration building
];

function typewriter(text: string, progress: number): string {
  const len = Math.floor(Math.min(progress, 1) * text.length);
  return text.slice(0, len);
}

export const ProblemSolutionScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // === Repeating prompt (frames 0 to OVER1_FRAME) ===
  const promptOpacity = interpolate(frame, [OVER1_FRAME - 15, OVER1_FRAME], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Find active cycle
  let activePrompt = "";
  const cursorBlink = Math.floor(frame / 15) % 2 === 0;
  for (const cycle of PROMPT_CYCLES) {
    if (frame >= cycle.start) {
      const progress = (frame - cycle.start) / cycle.typeDuration;
      activePrompt = typewriter(PROMPT_TEXT, progress);
    }
  }

  // === Part 1: "Over." repetition (synced to voiceover) ===
  const part1Opacity = interpolate(frame, [OVER4_FRAME + 20, FEED_START], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const over1Opacity = interpolate(frame, [OVER1_FRAME, OVER1_FRAME + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const over1Fade = interpolate(frame, [OVER2_FRAME, OVER2_FRAME + 10], [1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const over2Opacity = interpolate(frame, [OVER2_FRAME, OVER2_FRAME + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const over2Fade = interpolate(frame, [OVER3_FRAME, OVER3_FRAME + 10], [1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const over3Opacity = interpolate(frame, [OVER3_FRAME, OVER3_FRAME + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const over3Fade = interpolate(frame, [OVER4_FRAME, OVER4_FRAME + 10], [1, 0.35], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const over4Opacity = interpolate(frame, [OVER4_FRAME, OVER4_FRAME + 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // === Part 2: App screenshots (from FEED_START) ===
  const feedEnter = spring({
    frame: Math.max(0, frame - FEED_START),
    fps,
    config: { damping: 14, mass: 0.8, stiffness: 80 },
  });
  const feedY = interpolate(feedEnter, [0, 1], [400, 0]);
  const feedOpacity = interpolate(frame, [FEED_START, FEED_START + 40], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Slow vertical pan: simulate scrolling down the feed
  const feedScrollY = interpolate(frame, [FEED_START + 40, 550], [0, -120], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "One glance" text overlay — VO says it at ~15.4s = frame 462
  const glanceOpacity =
    interpolate(frame, [455, 475], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [540, 570], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // Final fade out
  const finalFade = interpolate(frame, [600, 648], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: finalFade,
      }}
    >
      {/* Repeating prompt — "tired of asking the same things" */}
      {frame < OVER1_FRAME && (
        <div
          style={{
            opacity: promptOpacity,
            fontFamily: FONT_MONO,
            fontSize: 32,
            color: TEXT_MUTED,
            whiteSpace: "pre",
          }}
        >
          <span style={{ color: "rgba(113,113,122,0.5)" }}>{">"} </span>
          {activePrompt}
          <span style={{ opacity: cursorBlink ? 1 : 0 }}>|</span>
        </div>
      )}

      {/* "Over." repetition — synced to VO */}
      {frame >= OVER1_FRAME && frame < FEED_START && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            opacity: part1Opacity,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 48,
              color: TEXT_PRIMARY,
              fontWeight: 700,
              opacity: over1Opacity * over1Fade,
            }}
          >
            Over.
          </div>
          {frame >= OVER2_FRAME && (
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 72,
                color: TEXT_PRIMARY,
                fontWeight: 700,
                opacity: over2Opacity * over2Fade,
              }}
            >
              Over.
            </div>
          )}
          {frame >= OVER3_FRAME && (
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 96,
                color: TEXT_PRIMARY,
                fontWeight: 800,
                opacity: over3Opacity * over3Fade,
              }}
            >
              Over.
            </div>
          )}
          {frame >= OVER4_FRAME && (
            <div
              style={{
                fontFamily: FONT_SANS,
                fontSize: 130,
                color: TEXT_PRIMARY,
                fontWeight: 800,
                opacity: over4Opacity,
              }}
            >
              Over.
            </div>
          )}
        </div>
      )}

      {/* Part 2: App feed screenshot with scroll pan — white bg to match app */}
      {frame >= FEED_START && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: feedOpacity,
            backgroundColor: "white",
          }}
        >
          <div
            style={{
              width: 1400,
              height: 850,
              borderRadius: 16,
              overflow: "hidden",
              boxShadow: "0 8px 40px rgba(0,0,0,0.08)",
              transform: `translateY(${feedY}px)`,
            }}
          >
            <div
              style={{
                transform: `translateY(${feedScrollY}px)`,
              }}
            >
              <Img
                src={staticFile("captures/feed-full.png")}
                style={{
                  width: 1400,
                  objectFit: "cover",
                  objectPosition: "top",
                }}
              />
            </div>
          </div>

          {/* "One glance" text overlay — centered, black on white bg */}
          {frame >= 455 && frame <= 580 && (
            <AbsoluteFill
              style={{
                justifyContent: "center",
                alignItems: "center",
                backgroundColor: "white",
                opacity: glanceOpacity,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_SANS,
                  fontSize: 52,
                  fontWeight: 700,
                  color: "#09090b",
                }}
              >
                One glance — and you know everything.
              </div>
            </AbsoluteFill>
          )}
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
