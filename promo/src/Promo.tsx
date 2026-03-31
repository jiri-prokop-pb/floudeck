import { AbsoluteFill, Series } from "remotion";
import { TitleScene } from "./scenes/TitleScene.tsx";
import { FeatureScene } from "./scenes/FeatureScene.tsx";

export const Promo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      <Series>
        <Series.Sequence durationInFrames={90}>
          <TitleScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={90}>
          <FeatureScene />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};
