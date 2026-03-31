/**
 * Capture server for promo video screenshots.
 * Like test-server.ts but with rich demo data and prompt-aware responses.
 */

import { createMockRunner } from "../../src/runner.ts";
import { createApp } from "../../src/server.ts";
import { DEMO_BLOCKS, getDemoMarkdown, TRY_DEMO_MARKDOWN } from "./demo-data.ts";

const portValue = process.env.CAPTURE_PORT;
if (!portValue) {
  throw new Error("CAPTURE_PORT is required. Run via `bun run promo:capture`.");
}

const PORT = Number(portValue);
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error(`Invalid CAPTURE_PORT: ${portValue}`);
}

const mockRunner = createMockRunner(async (prompt) => {
  await new Promise((r) => setTimeout(r, 300));

  // Check for matching demo content
  const markdown = getDemoMarkdown(prompt);
  if (markdown) {
    return { ok: true, markdown, reasoning: "Demo data" };
  }

  // Try mode responses
  if (prompt.toLowerCase().includes("calendar") || prompt.toLowerCase().includes("meeting")) {
    return { ok: true, markdown: TRY_DEMO_MARKDOWN, reasoning: "Demo try" };
  }

  // Fallback for any other prompt
  return {
    ok: true,
    markdown: `# Result\n\nOutput for: ${prompt.slice(0, 100)}`,
    reasoning: "Fallback",
  };
});

const app = createApp({
  port: PORT,
  runBlock: mockRunner,
  runAction: mockRunner,
  runTry: mockRunner,
  tickIntervalMs: 500,
  development: true,
});

console.log(`capture server running on port ${app.server.port}`);

process.on("SIGINT", () => {
  app.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  app.close();
  process.exit(0);
});
