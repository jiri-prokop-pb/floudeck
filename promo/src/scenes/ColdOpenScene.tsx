import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { FONT_SANS, TEXT_PRIMARY } from "../constants";

export const ColdOpenScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Background image fade in over frames 0–30
  const bgOpacity = interpolate(frame, [0, 30], [0, 0.75], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // "What if..." text (shifted +18 frames for longer VO)
  const whatIfOpacity = interpolate(frame, [318, 358], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const whatIfGlow = interpolate(frame, [318, 388], [0, 0.4], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Final fade to black
  const finalFade = interpolate(frame, [388, 414], [1, 0], {
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
      {/* Background image */}
      <Img
        src={staticFile("monday-scene.png")}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: bgOpacity,
        }}
      />

      {/* "What if your morning briefing was already there?" */}
      {frame >= 318 && (
        <div
          style={{
            position: "absolute",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          {/* Indigo glow behind text */}
          <div
            style={{
              position: "absolute",
              width: 800,
              height: 200,
              borderRadius: "50%",
              background: `radial-gradient(circle, rgba(99,102,241,${whatIfGlow}) 0%, transparent 70%)`,
              filter: "blur(40px)",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 52,
              color: TEXT_PRIMARY,
              fontWeight: 600,
              opacity: whatIfOpacity,
              position: "relative",
            }}
          >
            What if your morning briefing was already there?
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
