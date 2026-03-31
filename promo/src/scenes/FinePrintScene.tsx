import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT_SANS, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from "../constants";

const LINES = [
  "Quality of your prompt matters",
  "It runs the Claude process under the hood",
  "Each block runs in its own folder",
  "There's try-and-debug mode",
  "Permissions need to be set correctly",
  "Sandbox mode available",
  "It can consume tokens like a teenager consumes WiFi",
  "Prefer low-frequency updates",
];

const LINE_STAGGER = 33; // frames between each line entry
const LINE_ENTER = 12; // frames to slide in
const LINE_HOLD = 10; // frames to hold in place
const LINE_EXIT = 12; // frames to scroll up and out

export const FinePrintScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Title: "The Fine Print™"
  const titleOpacity = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleFade = interpolate(frame, [300, 321], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Underline width animation
  const underlineWidth = spring({
    frame: Math.max(0, frame - 10),
    fps,
    config: { damping: 15, mass: 0.6, stiffness: 100 },
  });

  // Final fade
  const fadeOut = interpolate(frame, [300, 321], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fadeOut, overflow: "hidden" }}>
      {/* Title */}
      <AbsoluteFill
        style={{
          justifyContent: "flex-start",
          alignItems: "center",
          paddingTop: 120,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            opacity: titleOpacity * titleFade,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 56,
              fontWeight: 700,
              color: TEXT_PRIMARY,
            }}
          >
            The Fine Print™
          </div>
          <div
            style={{
              height: 1,
              width: `${underlineWidth * 300}px`,
              backgroundColor: TEXT_MUTED,
            }}
          />
        </div>
      </AbsoluteFill>

      {/* Scrolling disclaimer lines */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            position: "relative",
            width: 900,
            height: 400,
            overflow: "hidden",
          }}
        >
          {LINES.map((line, i) => {
            const lineStart = 30 + i * LINE_STAGGER;
            const lineFrame = frame - lineStart;

            if (lineFrame < -5) return null;

            // Enter from right
            const enterX = interpolate(
              lineFrame,
              [0, LINE_ENTER],
              [600, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const enterOpacity = interpolate(
              lineFrame,
              [0, LINE_ENTER],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            // Scroll up and out
            const scrollStart = LINE_ENTER + LINE_HOLD;
            const totalLifespan = LINE_STAGGER * (LINES.length - i) + 40;
            const scrollY = interpolate(
              lineFrame,
              [scrollStart, scrollStart + totalLifespan],
              [0, -350],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );
            const scrollOpacity = interpolate(
              lineFrame,
              [scrollStart + totalLifespan - 30, scrollStart + totalLifespan],
              [1, 0],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            // Vertical position: each line starts at a base Y, then scrolls up
            const baseY = 180 + i * 0; // all start at same Y, scroll differentiates

            return (
              <div
                key={line}
                style={{
                  position: "absolute",
                  left: 0,
                  top: baseY + scrollY,
                  width: "100%",
                  fontFamily: FONT_SANS,
                  fontSize: 20,
                  color: TEXT_SECONDARY,
                  opacity: enterOpacity * scrollOpacity,
                  transform: `translateX(${enterX}px)`,
                  whiteSpace: "nowrap",
                }}
              >
                {line}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
