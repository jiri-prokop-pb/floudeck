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
    mockHtml: `<div class="flex items-center gap-3">
  <span class="inline-block w-4 h-4 rounded-full bg-green-500"></span>
  <strong class="text-green-600 text-lg">UP</strong>
  <span class="text-zinc-500 text-sm">All Systems Operational</span>
</div>
<div class="mt-2 text-xs text-zinc-400">Git Operations, API Requests, Actions, Packages, Pages, Codespaces, Copilot — all normal</div>`,
  },
  {
    prompt:
      "What are my currently opened PR titles in `pb-frontend`? Use `gh pr list`.",
    intervalValue: 1,
    intervalUnit: "hours",
    mockHtml: `<div>
  <h4 class="text-sm font-semibold text-zinc-700 mb-2">Open PRs in pb-frontend</h4>
  <ul class="space-y-1 text-sm">
    <li class="flex items-center gap-2">
      <span class="text-green-600 font-mono text-xs">#142</span>
      <span>Fix sidebar collapse animation on mobile</span>
    </li>
    <li class="flex items-center gap-2">
      <span class="text-green-600 font-mono text-xs">#139</span>
      <span>Add dark mode toggle to settings page</span>
    </li>
    <li class="flex items-center gap-2">
      <span class="text-green-600 font-mono text-xs">#137</span>
      <span>Upgrade React Router to v7</span>
    </li>
  </ul>
</div>`,
  },
];

// Start server with mock runner that returns our example HTML
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
    html: block.mockHtml,
    rawHtml: block.mockHtml,
    reasoning: null,
  };
});

const app = createApp({
  port: PORT,
  runBlock: mockRunner,
  tickIntervalMs: 500,
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
