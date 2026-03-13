import { defineConfig } from "@playwright/test";

const portValue = process.env.E2E_PORT;
if (!portValue) {
  throw new Error("E2E_PORT is required. Run the suite via `bun run e2e`.");
}

const PORT = Number(portValue);
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error(`Invalid E2E_PORT: ${portValue}`);
}

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
