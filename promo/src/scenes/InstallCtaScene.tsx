import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import {
  FONT_MONO,
  FONT_SANS,
  GREEN,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../constants";

const COMMAND = "brew install --cask jiri-prokop-pb/tap/floudeck";

function typewriter(text: string, progress: number): string {
  const len = Math.floor(progress * text.length);
  return text.slice(0, len);
}

export const InstallCtaScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Cursor blink
  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  // Command typewriter (20-80)
  const commandProgress = interpolate(frame, [20, 78], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typedCommand = typewriter(COMMAND, commandProgress);
  const showTypingCursor = frame >= 0 && frame < 100;

  // GitHub URL fade in (100-130)
  const urlOpacity = interpolate(frame, [100, 130], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "Star it. Fork it. Judge our code." — staggered
  const starOpacity = interpolate(frame, [140, 150], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const forkOpacity = interpolate(frame, [150, 160], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const judgeOpacity = interpolate(frame, [160, 170], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out (175-195)
  const fadeOut = interpolate(frame, [175, 195], [1, 0], {
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 32,
        }}
      >
        {/* Terminal command */}
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 36,
            whiteSpace: "pre",
          }}
        >
          <span style={{ color: TEXT_MUTED }}>$ </span>
          <span style={{ color: GREEN }}>{typedCommand}</span>
          {showTypingCursor && (
            <span
              style={{
                color: TEXT_PRIMARY,
                opacity: cursorVisible ? 1 : 0,
              }}
            >
              |
            </span>
          )}
        </div>

        {/* GitHub URL */}
        {frame >= 100 && (
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 24,
              color: TEXT_SECONDARY,
              opacity: urlOpacity,
              textDecoration: "underline",
              textDecorationColor: "rgba(161,161,170,0.4)",
              textUnderlineOffset: 4,
            }}
          >
            github.com/jiri-prokop-pb/floudeck
          </div>
        )}

        {/* CTA phrases */}
        {frame >= 140 && (
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 28,
              color: TEXT_PRIMARY,
              fontWeight: 500,
              display: "flex",
              gap: 24,
            }}
          >
            <span style={{ opacity: starOpacity }}>Star it.</span>
            <span style={{ opacity: forkOpacity }}>Fork it.</span>
            <span style={{ opacity: judgeOpacity }}>Judge our code.</span>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
