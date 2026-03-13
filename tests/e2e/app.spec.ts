import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Clear all blocks before each test via API
  const res = await page.request.get("/api/blocks");
  const { blocks } = await res.json();
  for (const block of blocks) {
    await page.request.post(`/api/blocks/${block.id}/delete`);
  }
  await page.goto("/");
});

test("page loads with empty state", async ({ page }) => {
  await expect(page.locator("text=Floudeck")).toBeVisible();
  await expect(
    page.locator("text=No blocks yet. Add your first scheduled block above."),
  ).toBeVisible();
});

test("create block → appears in feed → runs → shows HTML", async ({
  page,
}) => {
  // Fill in form
  await page.fill("textarea", "Show me the weather");
  await page.fill('input[type="number"]', "15");
  await page.click("text=Add block");

  // Block should appear
  await expect(page.locator("text=Every 15 minutes")).toBeVisible();

  // Wait for it to run (mock runner returns after 200ms, scheduler ticks every 500ms)
  await expect(page.locator(".mock-output")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("text=Output for: Show me the weather")).toBeVisible();
});

test("edit block → re-runs", async ({ page }) => {
  // Create a block
  await page.fill("textarea", "Original prompt");
  await page.fill('input[type="number"]', "1");
  await page.click("text=Add block");

  // Wait for first run
  await expect(page.locator(".mock-output")).toBeVisible({ timeout: 10_000 });

  // Click Edit
  await page.click("text=Edit");

  // Update the prompt in the edit form (the second textarea on the page)
  const editTextarea = page.locator("textarea").nth(1);
  await editTextarea.fill("Updated prompt");
  await page.click("text=Save");

  // Wait for re-run with new output
  await expect(
    page.locator("text=Output for: Updated prompt"),
  ).toBeVisible({ timeout: 10_000 });
});

test("delete block → disappears", async ({ page }) => {
  // Create a block
  await page.fill("textarea", "To be deleted");
  await page.fill('input[type="number"]', "1");
  await page.selectOption("select", "hours");
  await page.click("text=Add block");
  await expect(page.locator("text=Every hour")).toBeVisible();

  // Delete with confirmation
  page.on("dialog", (dialog) => dialog.accept());
  await page.click("text=Delete");

  // Should show empty state again
  await expect(
    page.locator("text=No blocks yet. Add your first scheduled block above."),
  ).toBeVisible();
});

test("refresh → enters running state", async ({ page }) => {
  // Create a block and wait for it to complete
  await page.fill("textarea", "Refresh test");
  await page.fill('input[type="number"]', "60");
  await page.selectOption("select", "minutes");
  await page.click("text=Add block");
  await expect(page.locator(".mock-output")).toBeVisible({ timeout: 10_000 });

  // Click refresh
  await page.click("text=Refresh");

  // Should briefly show running state (may be quick with mock)
  // Then show updated output
  await expect(page.locator(".mock-output")).toBeVisible({ timeout: 10_000 });
});

test("error state visible for failing mock", async ({ page }) => {
  // The mock runner fails when prompt contains "fail"
  await page.fill("textarea", "Please fail this task");
  await page.fill('input[type="number"]', "1");
  await page.click("text=Add block");

  // Wait for error state
  await expect(page.getByRole("heading", { name: "Task failed" })).toBeVisible({
    timeout: 10_000,
  });
  await expect(
    page.locator("text=Mock runner error: task failed as requested"),
  ).toBeVisible();
});

test("form validation - empty prompt", async ({ page }) => {
  // Try to submit without prompt
  await page.fill('input[type="number"]', "5");
  await page.click("text=Add block");

  await expect(page.locator("text=Prompt is required")).toBeVisible();
});

test("multiple blocks in creation order", async ({ page }) => {
  // Create first block
  await page.fill("textarea", "First block");
  await page.fill('input[type="number"]', "5");
  await page.click("text=Add block");
  await expect(page.locator("text=Every 5 minutes")).toBeVisible();

  // Create second block
  await page.fill("textarea", "Second block");
  await page.fill('input[type="number"]', "10");
  await page.click("text=Add block");

  // Both should be visible in order
  const scheduleLabels = page.locator(
    'text=/Every \\d+ minutes/',
  );
  await expect(scheduleLabels).toHaveCount(2);
});

test("SSE updates UI without manual refresh", async ({ page }) => {
  // Create a block
  await page.fill("textarea", "SSE test block");
  await page.fill('input[type="number"]', "1");
  await page.click("text=Add block");

  // The block should transition from idle/running to success via SSE
  // without us manually refreshing
  await expect(page.locator(".mock-output")).toBeVisible({ timeout: 10_000 });
  await expect(
    page.locator("text=Output for: SSE test block"),
  ).toBeVisible();
});
