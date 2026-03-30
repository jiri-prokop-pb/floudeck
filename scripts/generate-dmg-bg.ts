/**
 * Generates the DMG background image for the macOS installer.
 * Run: bun run scripts/generate-dmg-bg.ts
 *
 * Produces a 2x retina image (1320x800) that displays at 660x400 logical pixels.
 * The image shows subtle chevron arrows between the app and Applications icon positions.
 */

import { writeFileSync } from "node:fs";
import { createCanvas } from "@napi-rs/canvas";

const SCALE = 2; // retina
const W = 660 * SCALE;
const H = 400 * SCALE;

const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Background — light warm gray gradient
const bg = ctx.createLinearGradient(0, 0, 0, H);
bg.addColorStop(0, "#f5f5f4"); // stone-100
bg.addColorStop(1, "#e7e5e4"); // stone-200
ctx.fillStyle = bg;
ctx.fillRect(0, 0, W, H);

// Chevron arrows between app (x=180) and Applications (x=480), vertically centered at y=170
const centerX = ((180 + 480) / 2) * SCALE;
const centerY = 170 * SCALE;

ctx.strokeStyle = "#a8a29e"; // stone-400
ctx.lineWidth = 3 * SCALE;
ctx.lineCap = "round";
ctx.lineJoin = "round";

const chevronH = 14 * SCALE;
const chevronW = 8 * SCALE;
const gap = 6 * SCALE;

for (const offset of [-gap, gap]) {
  const x = centerX + offset - chevronW / 2;
  ctx.beginPath();
  ctx.moveTo(x, centerY - chevronH);
  ctx.lineTo(x + chevronW, centerY);
  ctx.lineTo(x, centerY + chevronH);
  ctx.stroke();
}

const outPath = new URL(
  "../src-tauri/icons/dmg-background.png",
  import.meta.url,
).pathname;
const buf = canvas.toBuffer("image/png");
writeFileSync(outPath, buf);
console.log(`Written ${outPath} (${W}x${H})`);
