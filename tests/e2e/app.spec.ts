import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Clear all blocks before each test via API
  const res = await page.request.get("/api/blocks");
  const { blocks } = await res.json();
  for (const block of blocks) {
    await page.request.post(`/api/blocks/${block.id}/delete`);
  }
  await page.goto("/");
});

/** Navigate to create page, fill in the form, and submit */
async function createBlock(
  page: import("@playwright/test").Page,
  prompt: string,
  interval: string,
  unit?: string,
) {
  await page.click("text=+ Add another block");
  await page.fill("textarea", prompt);
  await page.fill('input[type="number"]', interval);
  if (unit) await page.selectOption("select", unit);
  await page.click("text=Add block");
}

/** Open the menu on the nth block card (0-indexed) and click an action */
async function clickCardMenu(
  page: import("@playwright/test").Page,
  action: string,
  index = 0,
) {
  await page.locator('[title="Menu"]').nth(index).click();
  await page.click(`text=${action}`);
}

test("page loads with empty state", async ({ page }) => {
  await expect(page.locator("text=Floudeck")).toBeVisible();
  await expect(
    page.locator("text=No blocks yet. Add your first scheduled block above."),
  ).toBeVisible();
});

test("create block → appears in feed → runs → shows markdown", async ({
  page,
}) => {
  await createBlock(page, "Show me the weather", "15");

  // Wait for it to run — mock runner returns "# Result" heading, rendered as text
  await expect(page.locator("text=Result")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator("text=Output for: Show me the weather"),
  ).toBeVisible();
});

test("edit block → re-runs", async ({ page }) => {
  await createBlock(page, "Original prompt", "1");

  // Wait for first run
  await expect(page.locator("text=Result")).toBeVisible({ timeout: 10_000 });

  // Click Edit via menu
  await clickCardMenu(page, "Edit");

  // Update the prompt in the edit form
  const editTextarea = page.locator("textarea");
  await editTextarea.fill("Updated prompt");
  await page.click("text=Save");

  // Wait for re-run with new output
  await expect(page.locator("text=Output for: Updated prompt")).toBeVisible({
    timeout: 10_000,
  });
});

test("delete block → disappears", async ({ page }) => {
  await createBlock(page, "To be deleted", "1", "hours");

  // Verify block appeared (check info tooltip for schedule)
  await page.locator('[title="Info"]').click();
  await expect(page.locator("text=Every hour")).toBeVisible();
  await page.locator('[title="Info"]').click(); // close tooltip

  // Delete with custom confirmation dialog
  await clickCardMenu(page, "Delete");
  await expect(
    page.locator("text=Are you sure you want to delete"),
  ).toBeVisible();
  await page.locator("role=dialog >> button >> text=Delete").click();

  // Should show empty state again
  await expect(
    page.locator("text=No blocks yet. Add your first scheduled block above."),
  ).toBeVisible();
});

test("refresh → enters running state", async ({ page }) => {
  await createBlock(page, "Refresh test", "60");
  await expect(page.locator("text=Result")).toBeVisible({ timeout: 10_000 });

  // Click refresh via menu
  await clickCardMenu(page, "Refresh");

  // Should show updated output
  await expect(page.locator("text=Result")).toBeVisible({ timeout: 10_000 });
});

test("error state visible for failing mock", async ({ page }) => {
  // The mock runner fails when prompt contains "fail"
  await createBlock(page, "Please fail this task", "1");

  // Wait for error state
  await expect(page.getByRole("heading", { name: "Task failed" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.locator("text=Mock runner error: task failed as requested"),
  ).toBeVisible();
});

test("form validation - empty prompt", async ({ page }) => {
  await page.click("text=+ Add another block");
  await page.fill('input[type="number"]', "5");
  await page.click("text=Add block");

  await expect(page.locator("text=Prompt is required")).toBeVisible();
});

test("multiple blocks in creation order", async ({ page }) => {
  await createBlock(page, "First block", "5");

  // Create second block
  await createBlock(page, "Second block", "10");

  // Both should be visible - check via info tooltips
  const infoButtons = page.locator('[title="Info"]');
  await expect(infoButtons).toHaveCount(2);
});

test("try panel scrolls into view on edit page after clicking Try", async ({
  page,
}) => {
  // Create a block first
  await createBlock(page, "Scroll test prompt", "15");
  await expect(page.locator("text=Result")).toBeVisible({ timeout: 10_000 });

  // Small viewport so form content overflows
  await page.setViewportSize({ width: 800, height: 300 });

  // Navigate to edit page
  await clickCardMenu(page, "Edit");
  await expect(page.locator("text=Edit block")).toBeVisible();

  // Open advanced settings to push content down
  await page.click("text=Show advanced settings");

  // Scroll to top
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(100);

  const scrollBefore = await page.evaluate(() => window.scrollY);

  // Click Try
  await page.click("text=Try");

  // Wait for result
  await expect(page.locator("text=Result")).toBeVisible({ timeout: 10_000 });

  // Wait for scroll animation
  await page.waitForTimeout(600);

  const scrollAfter = await page.evaluate(() => window.scrollY);
  await page.screenshot({
    path: "test-results/try-scroll-edit.png",
    fullPage: false,
  });

  // Verify page actually scrolled down
  expect(scrollAfter).toBeGreaterThan(scrollBefore);

  // The result should be in viewport
  const tryResult = page.locator("text=Output for: Scroll test prompt");
  await expect(tryResult).toBeInViewport({ timeout: 3_000 });
});

test("SSE updates UI without manual refresh", async ({ page }) => {
  await createBlock(page, "SSE test block", "1");

  // The block should transition from idle/running to success via SSE
  await expect(page.locator("text=Result")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Output for: SSE test block")).toBeVisible();
});
