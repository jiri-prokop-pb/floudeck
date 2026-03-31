import { AbsoluteFill, Audio, Sequence, Series, staticFile, interpolate, useCurrentFrame } from "remotion";
import { SEGMENTS, SEGMENT_STARTS, TOTAL_FRAMES } from "./constants";
import { ColdOpenScene } from "./scenes/ColdOpenScene";
import { TitleDropScene } from "./scenes/TitleDropScene";
import { ProblemSolutionScene } from "./scenes/ProblemSolutionScene";
import { PowerUsersScene } from "./scenes/PowerUsersScene";
import { FeaturesScene } from "./scenes/FeaturesScene";
import { DangerZoneScene } from "./scenes/DangerZoneScene";
import { ComingSoonScene } from "./scenes/ComingSoonScene";
import { FinePrintScene } from "./scenes/FinePrintScene";
import { VibeCodingScene } from "./scenes/VibeCodingScene";
import { InstallCtaScene } from "./scenes/InstallCtaScene";
import { OutroScene } from "./scenes/OutroScene";

// SFX absolute frame positions (mapped to segment starts)
const SFX_BASS_HIT = SEGMENT_STARTS[1]; // Title drop start
const SFX_RECORD_SCRATCH = SEGMENT_STARTS[5]; // Danger zone start
const SFX_EXPLOSION = SEGMENT_STARTS[5] + 60; // ~2s into danger zone
const SFX_CHOIR = SEGMENT_STARTS[6] + 350; // Rust Rewrite reveal starts at frame 350 in ComingSoonScene
const SFX_WHOOSH_START = SEGMENT_STARTS[7] + 30; // Fine print lines start

export const Promo: React.FC = () => {
  const frame = useCurrentFrame();

  // Music volume: duck under voiceover to 15%, full between segments
  // Simple approach: always at 0.15 (ambient background)
  const musicVolume = (f: number) => {
    // Fade in over first 2s, then stay at 0.15, fade out in last 3s
    const fadeIn = interpolate(f, [0, 60], [0, 0.15], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    const fadeOut = interpolate(f, [TOTAL_FRAMES - 90, TOTAL_FRAMES], [0.15, 0], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    });
    return Math.min(fadeIn, fadeOut);
  };

  return (
    <AbsoluteFill style={{ backgroundColor: "#09090b" }}>
      {/* === SCENE SEQUENCE === */}
      <Series>
        <Series.Sequence durationInFrames={SEGMENTS.coldOpen.duration}>
          <ColdOpenScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.titleDrop.duration}>
          <TitleDropScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.problemSolution.duration}>
          <ProblemSolutionScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.powerUsers.duration}>
          <PowerUsersScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.features.duration}>
          <FeaturesScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.dangerZone.duration}>
          <DangerZoneScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.comingSoon.duration}>
          <ComingSoonScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.finePrint.duration}>
          <FinePrintScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.vibeCoding.duration}>
          <VibeCodingScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.installCta.duration}>
          <InstallCtaScene />
        </Series.Sequence>
        <Series.Sequence durationInFrames={SEGMENTS.outro.duration}>
          <OutroScene />
        </Series.Sequence>
      </Series>

      {/* === VOICEOVER — one Audio per segment at its absolute start frame === */}
      <Sequence from={SEGMENT_STARTS[0]} layout="none">
        <Audio src={staticFile("voiceover/01-cold-open.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[1]} layout="none">
        <Audio src={staticFile("voiceover/02-title-drop.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[2]} layout="none">
        <Audio src={staticFile("voiceover/03-problem-solution.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[3]} layout="none">
        <Audio src={staticFile("voiceover/04-power-users.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[4]} layout="none">
        <Audio src={staticFile("voiceover/05-features.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[5]} layout="none">
        <Audio src={staticFile("voiceover/06-danger-zone.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[6]} layout="none">
        <Audio src={staticFile("voiceover/07-coming-soon.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[7]} layout="none">
        <Audio src={staticFile("voiceover/08-fine-print.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[8]} layout="none">
        <Audio src={staticFile("voiceover/09-vibe-coding.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[9]} layout="none">
        <Audio src={staticFile("voiceover/10-install-cta.wav")} />
      </Sequence>
      <Sequence from={SEGMENT_STARTS[10]} layout="none">
        <Audio src={staticFile("voiceover/11-outro.wav")} />
      </Sequence>

      {/* === SFX === */}
      {/* Bass hit on title slam */}
      <Sequence from={SFX_BASS_HIT} layout="none">
        <Audio src={staticFile("sfx/bass-hit.wav")} />
      </Sequence>

      {/* Record scratch at danger zone entry */}
      <Sequence from={SFX_RECORD_SCRATCH} layout="none">
        <Audio src={staticFile("sfx/record-scratch.wav")} />
      </Sequence>

      {/* Explosion ~2s into danger zone */}
      <Sequence from={SFX_EXPLOSION} layout="none">
        <Audio src={staticFile("sfx/explosion-boom.wav")} />
      </Sequence>

      {/* Angelic choir for "The Rust Rewrite" */}
      <Sequence from={SFX_CHOIR} layout="none">
        <Audio src={staticFile("sfx/angelic-choir.wav")} />
      </Sequence>

      {/* Whoosh x6 as fine print lines fly in */}
      {Array.from({ length: 6 }).map((_, i) => (
        <Sequence key={`whoosh-${i}`} from={SFX_WHOOSH_START + i * 33} layout="none">
          <Audio src={staticFile("sfx/whoosh.wav")} />
        </Sequence>
      ))}

      {/* === BACKGROUND MUSIC === */}
      <Audio
        src={staticFile("music.mp3")}
        volume={musicVolume}
      />
    </AbsoluteFill>
  );
};
