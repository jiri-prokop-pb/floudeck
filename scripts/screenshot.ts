/**
 * Takes a screenshot of Floudeck with example blocks for the README.
 *
 * Usage:
 *   bun run scripts/screenshot.ts
 *
 * Prerequisites:
 *   - Playwright browsers installed: bunx playwright install chromium
 *   - No server running on port 3457
 *
 * Re-run this whenever you change app visuals or functionality.
 */
import { chromium } from "@playwright/test";
import { createMockRunner } from "../src/runner.ts";
import { createApp } from "../src/server.ts";

const PORT = 3457;
const OUTPUT = "docs/screenshot.png";

const EXAMPLE_BLOCKS = [
  {
    prompt: "Tell me if GitHub is up or down: https://www.githubstatus.com/",
    intervalValue: 15,
    intervalUnit: "minutes",
    mockMarkdown: `# GitHub Status

**UP** — All Systems Operational

Git Operations, API Requests, Actions, Packages, Pages, Codespaces, Copilot — all normal

[Generate report|blue](/action/BLOCK_UUID/generate) [View incident history|purple](/action/BLOCK_UUID/history) [Report issue|red](/action/BLOCK_UUID/report)`,
  },
  {
    prompt:
      "What are my currently opened PR titles in `pb-frontend`? Use `gh pr list`.",
    intervalValue: 1,
    intervalUnit: "hours",
    mockMarkdown: `# Open PRs in pb-frontend

| # | Title | Actions |
|---|-------|---------|
| #142 | Fix sidebar collapse animation on mobile | [Review\\|green](/action/BLOCK_UUID/review?pr=142) |
| #139 | Add dark mode toggle to settings page | [Review\\|green](/action/BLOCK_UUID/review?pr=139) |
| #137 | Upgrade React Router to v7 | [Review\\|green](/action/BLOCK_UUID/review?pr=137) |`,
  },
];

// Start server with mock runner that returns our example markdown
let blockIndex = 0;
const mockRunner = createMockRunner(async () => {
  const block = EXAMPLE_BLOCKS[blockIndex];
  blockIndex++;
  if (!block) {
    return { ok: false, error: "No more mock blocks" };
  }
  await new Promise((r) => setTimeout(r, 300));
  return {
    ok: true,
    markdown: block.mockMarkdown,
    reasoning: null,
  };
});

const app = createApp({
  port: PORT,
  runBlock: mockRunner,
  tickIntervalMs: 500,
  development: true,
});

try {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1024, height: 800 },
  });

  await page.goto(`http://localhost:${PORT}`);
  await page.waitForTimeout(500);

  // Create blocks via API (faster than filling the UI modal)
  for (const block of EXAMPLE_BLOCKS) {
    await fetch(`http://localhost:${PORT}/api/blocks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: block.prompt,
        intervalValue: block.intervalValue,
        intervalUnit: block.intervalUnit,
      }),
    });
  }

  // Reload so the page picks up the API-created blocks, then wait for output
  await page.reload();
  await page.waitForFunction(
    (count) => document.querySelectorAll(".prose").length >= count,
    EXAMPLE_BLOCKS.length,
  );

  // Take screenshot
  await page.screenshot({ path: OUTPUT, fullPage: true });
  console.log(`Screenshot saved to ${OUTPUT}`);

  await browser.close();
} finally {
  app.close();
}
