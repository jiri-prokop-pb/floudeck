import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { FONT_MONO, FONT_SANS, GREEN, TEXT_SECONDARY } from "../constants";

const TERMINAL_LINES = [
  { text: "claude", prompt: "$ ", start: 0, end: 30 },
  { text: '/context add "morning briefing"', prompt: "> ", start: 40, end: 80 },
  { text: "/insights --since yesterday", prompt: "> ", start: 90, end: 130 },
];

function typewriter(text: string, progress: number): string {
  const len = Math.floor(progress * text.length);
  return text.slice(0, len);
}

export const PowerUsersScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Cursor blink
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  // Determine active typing line
  const activeLineIndex = TERMINAL_LINES.findIndex(
    (l) => frame >= l.start && frame < l.end
  );

  // Fade out
  const fadeOut = interpolate(frame, [170, 210], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Scanline effect
  const scanlineOpacity = frame < 210 ? 0.06 : 0;

  // Bridge text: "Here's what it can do for you."
  const bridgeOpacity = interpolate(frame, [140, 155], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: fadeOut,
      }}
    >
      {/* Scanline overlay */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: scanlineOpacity,
          background:
            "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.08) 2px, rgba(255,255,255,0.08) 4px)",
          pointerEvents: "none",
          zIndex: 10,
        }}
      />

      {/* Terminal: green monospace text, left-aligned */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          paddingLeft: 160,
          paddingRight: 160,
          width: "100%",
        }}
      >
        {TERMINAL_LINES.map((line, i) => {
          const progress = interpolate(
            frame,
            [line.start, line.end],
            [0, 1],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
          );
          if (frame < line.start) return null;

          const typed = typewriter(line.text, progress);
          const showCursor = activeLineIndex === i && cursorVisible;

          return (
            <div
              key={line.text}
              style={{
                fontFamily: FONT_MONO,
                fontSize: 38,
                color: GREEN,
                fontWeight: 500,
                whiteSpace: "pre",
              }}
            >
              <span style={{ color: "rgba(34,197,94,0.5)" }}>{line.prompt}</span>
              {typed}
              <span style={{ opacity: showCursor ? 1 : 0, color: GREEN }}>
                _
              </span>
            </div>
          );
        })}
      </div>

      {/* Bridge text */}
      {frame >= 140 && (
        <div
          style={{
            position: "absolute",
            bottom: 180,
            fontFamily: FONT_SANS,
            fontSize: 40,
            color: TEXT_SECONDARY,
            fontWeight: 500,
            opacity: bridgeOpacity,
            textAlign: "center",
          }}
        >
          Here's what it can do for you.
        </div>
      )}
    </AbsoluteFill>
  );
};
