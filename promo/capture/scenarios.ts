/**
 * Playwright capture scenarios for the promo video.
 *
 * Captures screenshots of specific UI states for use in Remotion scenes.
 * Run via: bun run promo:capture
 *
 * Outputs to: promo/public/captures/
 */

import { chromium } from "playwright";
import { getFreePort } from "../../scripts/e2e-port.ts";
import { DEMO_BLOCKS, TRY_DEMO_PROMPT } from "./demo-data.ts";

const VIEWPORT = { width: 1920, height: 1080 };
const OUTPUT_DIR = `${import.meta.dir}/../public/captures`;


async function main() {
  // Start capture server
  const port = await getFreePort();
  const serverProc = Bun.spawn(
    ["bun", "run", `${import.meta.dir}/capture-server.ts`],
    {
      env: { ...process.env, CAPTURE_PORT: String(port) },
      stdout: "pipe",
      stderr: "inherit",
    },
  );

  // Wait for server to be ready
  const reader = serverProc.stdout.getReader();
  const decoder = new TextDecoder();
  let serverReady = false;
  while (!serverReady) {
    const { value } = await reader.read();
    if (value && decoder.decode(value).includes("capture server running")) {
      serverReady = true;
    }
  }
  reader.releaseLock();

  const baseURL = `http://localhost:${port}`;
  console.log(`Capture server ready at ${baseURL}`);

  // Ensure output dir exists
  await Bun.write(`${OUTPUT_DIR}/.gitkeep`, "");

  const browser = await chromium.launch({ headless: true });

  try {
    // ─── Scenario 1: Main feed with multiple blocks ───
    await captureFeed(browser, baseURL);

    // ─── Scenario 2: Block creation form ───
    await captureBlockForm(browser, baseURL);

    // ─── Scenario 3: Action links in markdown output ───
    // (already captured in feed — the PR Review block has action links)

    // ─── Scenario 4: Try mode ───
    await captureTryMode(browser, baseURL);

    // ─── Scenario 5: Settings page ───
    await captureSettings(browser, baseURL);

    console.log(`\nAll captures saved to ${OUTPUT_DIR}/`);
  } finally {
    await browser.close();
    serverProc.kill();
  }
}

/**
 * Capture 1: Main feed with 4 blocks showing rich markdown.
 * Used in Segment 3 (Problem + Solution).
 */
async function captureFeed(
  browser: import("playwright").Browser,
  baseURL: string,
) {
  console.log("\n📸 Capturing: Main feed");
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(baseURL);

  // Create all demo blocks via API with tryResult to pre-populate content
  for (const block of DEMO_BLOCKS) {
    await page.request.post(`${baseURL}/api/blocks`, {
      data: {
        prompt: block.prompt,
        intervalValue: block.interval,
        intervalUnit: block.unit,
        tryResult: block.markdown,
      },
    });
  }

  // Reload to show the pre-populated blocks
  await page.reload();
  await page.waitForSelector("text=PR Review Queue", { timeout: 10_000 });
  await page.waitForSelector("text=Production Health", { timeout: 5_000 });
  await page.waitForSelector("text=Standup Prep", { timeout: 5_000 });

  // Full page screenshot (scrollable feed)
  await page.screenshot({
    path: `${OUTPUT_DIR}/feed-full.png`,
    fullPage: true,
  });

  // Viewport-sized screenshot (above the fold)
  await page.screenshot({
    path: `${OUTPUT_DIR}/feed-viewport.png`,
    fullPage: false,
  });

  // Scroll to show more blocks and capture mid-feed
  await page.evaluate(() => window.scrollBy(0, 400));
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${OUTPUT_DIR}/feed-scrolled.png`,
    fullPage: false,
  });

  // Capture a single block card with action links (PR Review)
  const firstCard = page.locator(".rounded-2xl.border.border-zinc-200").first();
  await firstCard.screenshot({ path: `${OUTPUT_DIR}/block-card-actions.png` });

  // Open info tooltip on first block
  await page.locator('[title="Info"]').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${OUTPUT_DIR}/feed-info-tooltip.png`,
    fullPage: false,
  });
  await page.locator('[title="Info"]').first().click(); // close

  // Open menu on first block
  await page.locator('[title="Menu"]').first().click();
  await page.waitForTimeout(300);
  await page.screenshot({
    path: `${OUTPUT_DIR}/feed-menu-open.png`,
    fullPage: false,
  });

  await page.close();
  console.log("  ✅ feed-full.png, feed-viewport.png, feed-scrolled.png, block-card-actions.png, feed-info-tooltip.png, feed-menu-open.png");
}

/**
 * Capture 2: Block creation form with schedule config.
 * Used in Segment 5 (Features Showcase) at 0:38–0:40.
 */
async function captureBlockForm(
  browser: import("playwright").Browser,
  baseURL: string,
) {
  console.log("\n📸 Capturing: Block creation form");
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(baseURL);

  // Navigate to create page
  await page.click("text=+ Add another block");
  await page.waitForTimeout(500);

  // Fill in a realistic prompt
  await page.fill(
    "textarea",
    "Check production error rates and alert if any endpoint exceeds 1% error rate in the last hour. Include top 5 errors with stack traces.",
  );
  await page.fill('input[type="number"]', "30");
  await page.selectOption("select", "minutes");

  await page.screenshot({
    path: `${OUTPUT_DIR}/form-basic.png`,
    fullPage: false,
  });

  // Show advanced settings
  await page.click("text=Show advanced settings");
  await page.waitForTimeout(300);

  // Fill in some advanced fields
  await page.locator('input[placeholder="sonnet"]').fill("claude-sonnet-4-5-20250514");

  await page.screenshot({
    path: `${OUTPUT_DIR}/form-advanced.png`,
    fullPage: true,
  });

  await page.close();
  console.log("  ✅ form-basic.png, form-advanced.png");
}

/**
 * Capture 3: Try mode showing prompt test result.
 * Used in Segment 5 (Features Showcase) at 0:44–0:46.
 */
async function captureTryMode(
  browser: import("playwright").Browser,
  baseURL: string,
) {
  console.log("\n📸 Capturing: Try mode");
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(baseURL);

  // Navigate to create page
  await page.click("text=+ Add another block");
  await page.waitForTimeout(500);

  // Fill prompt
  await page.fill("textarea", TRY_DEMO_PROMPT);
  await page.fill('input[type="number"]', "1");
  await page.selectOption("select", "days");

  // Click Try
  await page.click("text=Try");

  // Wait for try result
  await page.waitForSelector("text=Today's Meetings", { timeout: 10_000 });
  await page.waitForTimeout(500);

  await page.screenshot({
    path: `${OUTPUT_DIR}/try-mode.png`,
    fullPage: true,
  });

  await page.close();
  console.log("  ✅ try-mode.png");
}

/**
 * Capture 4: Settings page.
 * Used in Segment 5 (Features Showcase) at 0:46–0:48.
 */
async function captureSettings(
  browser: import("playwright").Browser,
  baseURL: string,
) {
  console.log("\n📸 Capturing: Settings page");
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(`${baseURL}/settings`);
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: `${OUTPUT_DIR}/settings.png`,
    fullPage: true,
  });

  await page.close();
  console.log("  ✅ settings.png");
}

main().catch((err) => {
  console.error("Capture failed:", err);
  process.exit(1);
});
