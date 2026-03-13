import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT) || 3456;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: `http://localhost:${PORT}`,
    headless: true,
  },
  projects: [
    {
      name: "chromium",
      use: { browserName: "chromium" },
    },
  ],
  webServer: {
    command: `bun run tests/e2e/test-server.ts`,
    port: PORT,
    reuseExistingServer: !process.env.CI,
    timeout: 10_000,
  },
});
