import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import {
  FONT_SANS,
  TEXT_MUTED,
  TEXT_PRIMARY,
} from "../constants";

function typewriter(text: string, progress: number): string {
  const len = Math.floor(progress * text.length);
  return text.slice(0, len);
}

export const VibeCodingScene: React.FC = () => {
  const frame = useCurrentFrame();

  // --- Phase 1: "Wait... who built this?" typewriter (0-40) ---
  const questionProgress = interpolate(frame, [0, 35], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const questionText = typewriter("Wait... who built this?", questionProgress);

  const cursorVisible = Math.floor(frame / 15) % 2 === 0;

  // Question fade out (50-90)
  const questionOpacity = interpolate(frame, [50, 90], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Phase 2: Image slides in from right (90-250) ---
  const imageX = interpolate(frame, [90, 130], [1920, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const imageOpacity =
    interpolate(frame, [90, 120], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [250, 320], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // Ken Burns zoom: subtle 1.0 -> 1.05 over the image hold
  const kenBurnsScale = interpolate(frame, [90, 250], [1.0, 1.05], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Caption fade in (160-220)
  const captionOpacity =
    interpolate(frame, [160, 200], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }) *
    interpolate(frame, [270, 310], [1, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });

  // --- Phase 3: "Okay fine, it's vibe-coding." (250-350) ---
  const vibeOpacity = interpolate(frame, [270, 310], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Playful subtle tilt
  const vibeTilt = interpolate(frame, [270, 320], [-2, 1.5], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // --- Final fade to black (350-375) ---
  const fadeOut = interpolate(frame, [350, 375], [1, 0], {
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
      {/* Phase 1: Question text */}
      {frame < 90 && (
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 48,
            color: TEXT_PRIMARY,
            fontWeight: 500,
            opacity: questionOpacity,
            position: "absolute",
          }}
        >
          {questionText}
          <span style={{ opacity: cursorVisible && frame < 50 ? 1 : 0 }}>
            |
          </span>
        </div>
      )}

      {/* Phase 2: Image with Ken Burns */}
      {frame >= 90 && (
        <div
          style={{
            position: "absolute",
            width: "90%",
            height: "75%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            opacity: imageOpacity,
            transform: `translateX(${imageX}px)`,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              borderRadius: 12,
            }}
          >
            <div
              style={{
                width: "100%",
                height: "100%",
                transform: `scale(${kenBurnsScale})`,
              }}
            >
              <Img
                src={staticFile("vibecoding.png")}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            </div>
          </div>

          {/* Caption */}
          <div
            style={{
              fontFamily: FONT_SANS,
              fontSize: 20,
              color: TEXT_MUTED,
              fontStyle: "italic",
              fontWeight: 400,
              marginTop: 16,
              opacity: captionOpacity,
            }}
          >
            The entire engineering department.
          </div>
        </div>
      )}

      {/* Phase 3: Vibe-coding text overlay */}
      {frame >= 270 && (
        <div
          style={{
            position: "absolute",
            fontFamily: FONT_SANS,
            fontSize: 36,
            color: TEXT_PRIMARY,
            fontWeight: 500,
            opacity: vibeOpacity,
            transform: `rotate(${vibeTilt}deg)`,
          }}
        >
          Okay fine, it's vibe-coding.
        </div>
      )}
    </AbsoluteFill>
  );
};
