import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  AMBER,
  FONT_SANS,
  INDIGO_BORDER,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../constants";

interface FeatureItem {
  label: string;
  from: "left" | "right" | "top" | "bottom";
  frame: number;
  gridRow: number;
  gridCol: number;
}

const FEATURES: FeatureItem[] = [
  { label: "Standalone actions", from: "left", frame: 30, gridRow: 0, gridCol: 0 },
  { label: "Script mode", from: "right", frame: 60, gridRow: 0, gridCol: 1 },
  { label: "Chat with blocks", from: "top", frame: 90, gridRow: 0, gridCol: 2 },
  { label: "Claude Agent SDK", from: "bottom", frame: 120, gridRow: 1, gridCol: 0 },
  { label: "Reminders", from: "left", frame: 150, gridRow: 1, gridCol: 1 },
  { label: "Decks", from: "right", frame: 170, gridRow: 1, gridCol: 2 },
  { label: "Notifications", from: "top", frame: 190, gridRow: 2, gridCol: 0 },
  { label: "Cost tracking", from: "bottom", frame: 210, gridRow: 2, gridCol: 1 },
  { label: "TUI mode", from: "left", frame: 230, gridRow: 2, gridCol: 2 },
];

function getOffset(
  from: "left" | "right" | "top" | "bottom",
  progress: number
): { x: number; y: number } {
  const dist = interpolate(progress, [0, 1], [400, 0]);
  switch (from) {
    case "left":
      return { x: -dist, y: 0 };
    case "right":
      return { x: dist, y: 0 };
    case "top":
      return { x: 0, y: -dist };
    case "bottom":
      return { x: 0, y: dist };
  }
}

const NUM_RAYS = 10;

export const ComingSoonScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Grid dims slightly before reveal
  const gridDim = interpolate(frame, [250, 320], [1, 0.2], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "And the holy grail..." text
  const holyGrailOpacity = interpolate(frame, [320, 345], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Rust rewrite reveal
  const rustRevealProgress = spring({
    frame: Math.max(0, frame - 350),
    fps,
    config: { damping: 12, mass: 1.2, stiffness: 80 },
  });
  const rustOpacity = interpolate(frame, [350, 370], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const rustScale = interpolate(rustRevealProgress, [0, 1], [0.3, 1]);

  // Glow intensity
  const glowIntensity = interpolate(frame, [350, 420], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Lens flare movement
  const flareX = Math.sin(frame * 0.03) * 40;
  const flareY = Math.cos(frame * 0.02) * 20;

  // Ray rotation
  const rayRotation = frame * 0.15;

  // Final fade out
  const fadeOut = interpolate(frame, [460, 486], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Feature grid */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: gridDim,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 220px)",
            gridTemplateRows: "repeat(3, 60px)",
            gap: 16,
          }}
        >
          {FEATURES.map((feat) => {
            const progress = spring({
              frame: Math.max(0, frame - feat.frame),
              fps,
              config: { damping: 14, mass: 0.7, stiffness: 100 },
            });
            const { x, y } = getOffset(feat.from, progress);
            const opacity = interpolate(
              frame,
              [feat.frame, feat.frame + 15],
              [0, 1],
              { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
            );

            return (
              <div
                key={feat.label}
                style={{
                  gridRow: feat.gridRow + 1,
                  gridColumn: feat.gridCol + 1,
                  padding: "12px 20px",
                  borderRadius: 12,
                  backgroundColor: "rgba(99,102,241,0.08)",
                  border: `1px solid ${INDIGO_BORDER}`,
                  fontSize: 20,
                  fontFamily: FONT_SANS,
                  fontWeight: 600,
                  color: TEXT_PRIMARY,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  opacity,
                  transform: `translate(${x}px, ${y}px)`,
                }}
              >
                {feat.label}
              </div>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* "And the holy grail..." */}
      {frame >= 320 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            paddingBottom: 300,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 32,
              color: TEXT_SECONDARY,
              fontStyle: "italic",
              opacity: holyGrailOpacity,
            }}
          >
            And the holy grail...
          </div>
        </AbsoluteFill>
      )}

      {/* THE RUST REWRITE reveal */}
      {frame >= 350 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {/* Radial golden glow */}
          <div
            style={{
              position: "absolute",
              width: 900,
              height: 500,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(245,158,11,${0.35 * glowIntensity}) 0%, rgba(245,158,11,${0.1 * glowIntensity}) 40%, transparent 70%)`,
              filter: "blur(40px)",
            }}
          />

          {/* Animated light rays */}
          {Array.from({ length: NUM_RAYS }).map((_, i) => {
            const angle = (360 / NUM_RAYS) * i + rayRotation;
            const rayOpacity = 0.12 * glowIntensity;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  width: 4,
                  height: 600,
                  background: `linear-gradient(to top, transparent 0%, rgba(245,158,11,${rayOpacity}) 50%, transparent 100%)`,
                  transform: `rotate(${angle}deg)`,
                  transformOrigin: "center center",
                }}
              />
            );
          })}

          {/* Lens flare */}
          <div
            style={{
              position: "absolute",
              width: 80,
              height: 80,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(255,255,255,${0.7 * glowIntensity}) 0%, transparent 70%)`,
              transform: `translate(${flareX}px, ${flareY}px)`,
              filter: "blur(8px)",
            }}
          />

          {/* The text */}
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 80,
              fontWeight: 800,
              color: AMBER,
              opacity: rustOpacity,
              transform: `scale(${rustScale})`,
              textShadow: `0 0 40px rgba(245,158,11,${0.5 * glowIntensity})`,
              position: "relative",
            }}
          >
            The Rust Rewrite™
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
