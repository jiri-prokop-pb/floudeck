import { Composition } from "remotion";
import { Promo } from "./Promo.tsx";

export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="Promo"
      component={Promo}
      durationInFrames={180}
      fps={30}
      width={1920}
      height={1080}
    />
  );
};
