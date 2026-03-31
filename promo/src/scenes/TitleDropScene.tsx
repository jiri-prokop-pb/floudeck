import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { FONT_SANS, TEXT_PRIMARY, TEXT_SECONDARY } from "../constants";

export const TitleDropScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Logo slam: scale from 2.0 to 1.0 with heavy spring
  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 8, mass: 0.8, stiffness: 200 },
  });
  const logoScale = interpolate(logoSpring, [0, 1], [2.0, 1.0]);
  const logoOpacity = interpolate(frame, [0, 5], [0, 1], {
    extrapolateRight: "clamp",
  });

  // White flash on slam impact
  const flashOpacity = interpolate(frame, [0, 3, 10], [0.8, 0.6, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Tagline fade in + slide up
  const taglineOpacity = interpolate(frame, [30, 50], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const taglineY = interpolate(frame, [30, 50], [20, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out at end
  const fadeOut = interpolate(frame, [90, 114], [1, 0], {
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
          width: 700,
          height: 700,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(99,102,241,0.2) 0%, transparent 70%)",
          filter: "blur(50px)",
        }}
      />

      {/* White flash overlay */}
      <AbsoluteFill
        style={{
          backgroundColor: "white",
          opacity: flashOpacity,
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
            gap: 28,
            opacity: logoOpacity,
            transform: `scale(${logoScale})`,
          }}
        >
          <Img
            src={staticFile("logo.png")}
            style={{
              width: 100,
              height: 100,
              filter: "invert(1)",
            }}
          />
          <div
            style={{
              fontSize: 120,
              fontWeight: 800,
              color: TEXT_PRIMARY,
              fontFamily: FONT_SANS,
              letterSpacing: -3,
            }}
          >
            Floudeck
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 36,
            color: TEXT_SECONDARY,
            fontFamily: FONT_SANS,
            fontWeight: 400,
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
          }}
        >
          Claude Code — on autopilot
        </div>
      </div>
    </AbsoluteFill>
  );
};
