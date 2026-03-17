import { defineConfig } from "@playwright/test";
import { parseE2ePort } from "./scripts/e2e-port.ts";

const PORT = parseE2ePort();

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
