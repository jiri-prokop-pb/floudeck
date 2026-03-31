// Segment durations derived from actual voiceover WAV files
// Total: ~126s = 3780 frames at 30fps

export const FPS = 30;

export const SEGMENTS = {
  coldOpen: { index: 0, duration: 414, voiceover: "voiceover/01-cold-open.wav" },
  titleDrop: { index: 1, duration: 114, voiceover: "voiceover/02-title-drop.wav" },
  problemSolution: { index: 2, duration: 648, voiceover: "voiceover/03-problem-solution.wav" },
  powerUsers: { index: 3, duration: 210, voiceover: "voiceover/04-power-users.wav" },
  features: { index: 4, duration: 495, voiceover: "voiceover/05-features.wav" },
  dangerZone: { index: 5, duration: 300, voiceover: "voiceover/06-danger-zone.wav" },
  comingSoon: { index: 6, duration: 486, voiceover: "voiceover/07-coming-soon.wav" },
  finePrint: { index: 7, duration: 321, voiceover: "voiceover/08-fine-print.wav" },
  vibeCoding: { index: 8, duration: 375, voiceover: "voiceover/09-vibe-coding.wav" },
  installCta: { index: 9, duration: 195, voiceover: "voiceover/10-install-cta.wav" },
  outro: { index: 10, duration: 240, voiceover: "voiceover/11-outro.wav" },
} as const;

export const SEGMENT_LIST = Object.values(SEGMENTS);

export const TOTAL_FRAMES = SEGMENT_LIST.reduce((sum, s) => sum + s.duration, 0);

// Cumulative start frames for each segment (for absolute audio placement)
export const SEGMENT_STARTS = SEGMENT_LIST.reduce<number[]>((acc, s, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + SEGMENT_LIST[i - 1].duration);
  return acc;
}, []);

// Colors
export const BG = "#09090b";
export const TEXT_PRIMARY = "#fafafa";
export const TEXT_SECONDARY = "#a1a1aa";
export const TEXT_MUTED = "#71717a";
export const INDIGO = "rgba(99,102,241,0.15)";
export const INDIGO_BORDER = "rgba(99,102,241,0.25)";
export const RED = "#ef4444";
export const GREEN = "#22c55e";
export const AMBER = "#f59e0b";

// Typography
export const FONT_SANS = "system-ui, -apple-system, sans-serif";
export const FONT_MONO = "'SF Mono', 'Fira Code', 'Cascadia Code', monospace";
