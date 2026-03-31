import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {
  FONT_SANS,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from "../constants";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // "Floudeck" gentle spring scale (0-40)
  const titleSpring = spring({
    frame,
    fps,
    config: { damping: 14, mass: 0.6, stiffness: 120 },
  });
  const titleScale = interpolate(titleSpring, [0, 1], [0.9, 1.0]);
  const titleOpacity = interpolate(frame, [0, 30], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Radial glow pulse
  const glowOpacity = interpolate(frame, [0, 40], [0, 0.25], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline (40-80)
  const taglineOpacity = interpolate(frame, [40, 70], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [40, 70], [15, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Punchline (100-150) — delayed for comedic timing
  const punchlineOpacity = interpolate(frame, [110, 140], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Final cinematic fade (180-240)
  const fadeOut = interpolate(frame, [180, 240], [1, 0], {
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
      {/* Radial indigo glow */}
      <div
        style={{
          position: "absolute",
          width: 800,
          height: 800,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(99,102,241,${glowOpacity}) 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          position: "relative",
        }}
      >
        {/* Logo + Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 24,
            opacity: titleOpacity,
            transform: `scale(${titleScale})`,
          }}
        >
          <Img
            src={staticFile("logo.png")}
            style={{
              width: 80,
              height: 80,
              filter: "invert(1)",
            }}
          />
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 100,
              fontWeight: 800,
              color: TEXT_PRIMARY,
              letterSpacing: -2,
            }}
          >
            Floudeck
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 32,
            color: TEXT_SECONDARY,
            fontWeight: 400,
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          Because you have better things to do.
        </div>

        {/* Punchline */}
        {frame >= 100 && (
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 20,
              color: TEXT_MUTED,
              fontWeight: 400,
              opacity: punchlineOpacity,
              marginTop: 24,
            }}
          >
            Actually, you probably don't. But still.
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};
