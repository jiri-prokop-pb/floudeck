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

  // Wait for all blocks to have output before loading the page
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const res = await fetch(`http://localhost:${PORT}/api/blocks`);
    const data = (await res.json()) as {
      blocks: Array<{ status: string; output_markdown: string | null }>;
    };
    const allDone = data.blocks.every(
      (b) => b.status === "success" && b.output_markdown,
    );
    if (allDone && data.blocks.length === EXAMPLE_BLOCKS.length) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  // Reload so the page picks up completed blocks
  await page.reload();
  await page.waitForFunction(
    (count) => document.querySelectorAll(".prose").length >= count,
    EXAMPLE_BLOCKS.length,
  );

  // Take raw screenshot into buffer
  const rawScreenshot = await page.screenshot({ fullPage: true });
  const base64 = Buffer.from(rawScreenshot).toString("base64");

  // Wrap in macOS window frame with traffic lights + shadow
  const framePage = await browser.newPage({
    viewport: { width: 1124, height: 900 },
  });
  await framePage.setContent(`
    <html>
    <body style="margin:0;padding:40px 50px 60px;background:transparent;display:flex;justify-content:center;align-items:start">
      <div style="border-radius:10px;overflow:hidden;box-shadow:0 8px 30px rgba(0,0,0,0.12);display:inline-block;position:relative">
        <div style="position:absolute;top:14px;left:14px;display:flex;gap:8px;z-index:1">
          <div style="width:13px;height:13px;border-radius:50%;background:#FF5F57"></div>
          <div style="width:13px;height:13px;border-radius:50%;background:#FEBC2E"></div>
          <div style="width:13px;height:13px;border-radius:50%;background:#28C840"></div>
        </div>
        <img src="data:image/png;base64,${base64}" style="display:block;width:1024px" />
      </div>
    </body>
    </html>
  `);
  await framePage.screenshot({ path: OUTPUT, fullPage: true, omitBackground: true });
  console.log(`Screenshot saved to ${OUTPUT}`);

  await browser.close();
} finally {
  app.close();
}
