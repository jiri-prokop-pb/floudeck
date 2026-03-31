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
  BG,
  FONT_MONO,
  FONT_SANS,
  GREEN,
  TEXT_PRIMARY,
} from "../constants";

const CARD_DURATION = 83; // ~2.77s per card, 6 cards = 495 frames

interface FeatureCard {
  title: string;
  start: number;
  screenshot?: string;
  render?: (frame: number, cardFrame: number) => React.ReactNode;
}

const CheckMark: React.FC<{ visible: boolean }> = ({ visible }) => (
  <span
    style={{
      color: GREEN,
      fontSize: 32,
      fontWeight: 700,
      opacity: visible ? 1 : 0,
      marginLeft: 12,
    }}
  >
    ✓
  </span>
);

const CARDS: FeatureCard[] = [
  {
    title: "Scheduled prompts",
    start: 0,
    screenshot: "captures/form-basic.png",
  },
  {
    title: "Markdown + Action links",
    start: CARD_DURATION,
    screenshot: "captures/block-card-actions.png",
  },
  {
    title: "Try mode",
    start: CARD_DURATION * 2,
    screenshot: "captures/try-mode.png",
  },
  {
    title: "Per-block config",
    start: CARD_DURATION * 3,
    screenshot: "captures/settings.png",
  },
  {
    title: "Real-time updates",
    start: CARD_DURATION * 4,
    screenshot: "captures/feed-viewport.png",
  },
  {
    title: "API? MCP? CLI?",
    start: CARD_DURATION * 5,
    render: (_frame, cf) => {
      const items = [
        { label: "API", checkAt: 20 },
        { label: "MCP", checkAt: 35 },
        { label: "CLI", checkAt: 50 },
      ];
      return (
        <div
          style={{
            display: "flex",
            gap: 48,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          {items.map((item) => {
            const labelOpacity = interpolate(cf, [10, 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div
                key={item.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  opacity: labelOpacity,
                  fontSize: 36,
                  fontFamily: FONT_MONO,
                  fontWeight: 700,
                  color: "#09090b",
                }}
              >
                {item.label}
                <CheckMark visible={cf >= item.checkAt} />
              </div>
            );
          })}
        </div>
      );
    },
  },
];

export const FeaturesScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
        backgroundColor: BG,
      }}
    >
      {CARDS.map((card) => {
        const cardEnd = card.start + CARD_DURATION;
        const cardFrame = frame - card.start;

        // Spring entrance from right
        const enterProgress = spring({
          frame: Math.max(0, cardFrame),
          fps,
          config: { damping: 14, mass: 0.8, stiffness: 120 },
        });
        const enterX = interpolate(enterProgress, [0, 1], [600, 0]);

        // Exit to left
        const exitProgress =
          frame >= cardEnd - 15
            ? interpolate(frame, [cardEnd - 15, cardEnd], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })
            : 0;
        const exitX = interpolate(exitProgress, [0, 1], [0, -600]);
        const exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);

        // Only render if within range
        if (frame < card.start - 5 || frame > cardEnd + 5) return null;

        const x = enterX + exitX;

        // Screenshot cards: full-screen with bottom title overlay
        if (card.screenshot) {
          return (
            <AbsoluteFill
              key={card.title}
              style={{
                backgroundColor: BG,
                transform: `translateX(${x}px)`,
                opacity: exitOpacity,
              }}
            >
              <Img
                src={staticFile(card.screenshot)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
              {/* Bottom title overlay */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  background: "rgba(0,0,0,0.6)",
                  padding: "20px 40px",
                }}
              >
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: TEXT_PRIMARY,
                    fontFamily: FONT_SANS,
                  }}
                >
                  {card.title}
                </div>
              </div>
            </AbsoluteFill>
          );
        }

        // Custom render cards (API/MCP/CLI) — keep white background + centered layout
        return (
          <AbsoluteFill
            key={card.title}
            style={{
              justifyContent: "center",
              alignItems: "center",
              backgroundColor: "white",
              transform: `translateX(${x}px)`,
              opacity: exitOpacity,
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
              }}
            >
              <div
                style={{
                  fontSize: 32,
                  fontWeight: 700,
                  color: "#09090b",
                  fontFamily: FONT_SANS,
                }}
              >
                {card.title}
              </div>
              {card.render ? card.render(frame, cardFrame) : null}
            </div>
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};
