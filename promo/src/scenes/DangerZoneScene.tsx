import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { FONT_MONO, FONT_SANS, TEXT_MUTED, TEXT_PRIMARY } from "../constants";

const FLAG = "--dangerously-skip-permissions";

export const DangerZoneScene: React.FC = () => {
  const frame = useCurrentFrame();

  // Frame 0-15: Red flash
  const flashOpacity = interpolate(frame, [0, 5, 15], [0, 0.4, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Frame 15-90: Typewriter for the flag
  const typeProgress = interpolate(frame, [15, 85], [0, FLAG.length], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const typedChars = Math.floor(typeProgress);

  // Red wash background (builds up during typing, stays)
  const redWash = interpolate(frame, [15, 60], [0, 0.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Frame 90-180: Image fade in + Ken Burns zoom
  const imgOpacity = interpolate(frame, [90, 130], [0, 0.6], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imgScale = interpolate(frame, [90, 300], [1, 1.15], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Frame 180-260: Whisper text
  const whisperOpacity = interpolate(frame, [180, 220], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Frame 260-280: Disclaimer
  const disclaimerOpacity = interpolate(frame, [260, 278], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Frame 280-300: Everything fades out
  const fadeOut = interpolate(frame, [280, 300], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Flag text visibility
  const flagOpacity = frame >= 15 ? 1 : 0;

  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      {/* Red flash */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(239,68,68,${flashOpacity})`,
        }}
      />

      {/* Red wash background */}
      <AbsoluteFill
        style={{
          backgroundColor: `rgba(239,68,68,${redWash})`,
        }}
      />

      {/* This-is-fine image */}
      {frame >= 90 && (
        <AbsoluteFill
          style={{
            justifyContent: "center",
            alignItems: "center",
            opacity: imgOpacity,
          }}
        >
          <Img
            src={staticFile("this-is-fine.png")}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transform: `scale(${imgScale})`,
            }}
          />
          {/* Dark overlay for readability */}
          <AbsoluteFill
            style={{
              backgroundColor: "rgba(9,9,11,0.65)",
            }}
          />
        </AbsoluteFill>
      )}

      {/* Flag typewriter text */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: flagOpacity,
        }}
      >
        <div
          style={{
            fontFamily: FONT_MONO,
            fontSize: 62,
            fontWeight: 700,
            color: TEXT_PRIMARY,
            display: "flex",
            position: "relative",
          }}
        >
          {FLAG.split("").map((char, i) => {
            if (i >= typedChars) return null;
            // Per-character shake using sin/cos with unique offset
            const shakeX =
              Math.sin(frame * 3.7 + i * 11.3) *
              interpolate(frame, [15, 90], [3, 1.5], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
            const shakeY =
              Math.cos(frame * 2.9 + i * 7.7) *
              interpolate(frame, [15, 90], [3, 1.5], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
            return (
              <span
                key={`${i}-${char}`}
                style={{
                  display: "inline-block",
                  transform: `translate(${shakeX}px, ${shakeY}px)`,
                }}
              >
                {char}
              </span>
            );
          })}
        </div>
      </AbsoluteFill>

      {/* Whisper text */}
      {frame >= 180 && (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 140,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 24,
              color: TEXT_MUTED,
              opacity: whisperOpacity,
              textAlign: "center",
              maxWidth: 800,
              lineHeight: 1.6,
            }}
          >
            Use at your own risk. We are not responsible for what Claude does at
            3 AM.
          </div>
        </AbsoluteFill>
      )}

      {/* Serious disclaimer */}
      {frame >= 260 && (
        <AbsoluteFill
          style={{
            justifyContent: "flex-end",
            alignItems: "center",
            paddingBottom: 80,
          }}
        >
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 16,
              color: TEXT_MUTED,
              opacity: disclaimerOpacity,
              fontStyle: "italic",
            }}
          >
            Seriously though. Set your permissions correctly.
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
