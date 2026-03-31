import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const FEATURES = [
  { emoji: "🕐", label: "Scheduled prompts" },
  { emoji: "📝", label: "Markdown output" },
  { emoji: "⚡", label: "Action links" },
];

export const FeatureScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const headingOpacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 48,
        }}
      >
        <div
          style={{
            fontSize: 56,
            fontWeight: 700,
            color: "#fafafa",
            fontFamily: "system-ui, sans-serif",
            opacity: headingOpacity,
          }}
        >
          What it does
        </div>

        <div style={{ display: "flex", gap: 64 }}>
          {FEATURES.map((feature, i) => {
            const delay = 15 + i * 12;
            const scale = spring({
              frame: frame - delay,
              fps,
              config: { damping: 10, mass: 0.6 },
            });
            const opacity = interpolate(frame, [delay, delay + 10], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={feature.label}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 16,
                  opacity,
                  transform: `scale(${scale})`,
                }}
              >
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 24,
                    backgroundColor: "rgba(99,102,241,0.12)",
                    border: "1px solid rgba(99,102,241,0.25)",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: 48,
                  }}
                >
                  {feature.emoji}
                </div>
                <div
                  style={{
                    fontSize: 24,
                    color: "#d4d4d8",
                    fontFamily: "system-ui, sans-serif",
                    fontWeight: 500,
                  }}
                >
                  {feature.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
