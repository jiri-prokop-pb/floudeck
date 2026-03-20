/**
 * Standalone test server for E2E tests.
 * Uses a mock runner and :memory: SQLite so no real CLI calls or disk writes.
 * Starts on the port specified by E2E_PORT.
 */

import { createMockRunner } from "../../src/runner.ts";
import { createApp } from "../../src/server.ts";

const portValue = process.env.E2E_PORT;
if (!portValue) {
  throw new Error("E2E_PORT is required. Run the suite via `bun run e2e`.");
}

const PORT = Number(portValue);
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error(`Invalid E2E_PORT: ${portValue}`);
}

// Mock runner that returns realistic markdown after a short delay
const mockRunner = createMockRunner(async (prompt) => {
  await new Promise((r) => setTimeout(r, 200));
  if (prompt.toLowerCase().includes("fail")) {
    return { ok: false, error: "Mock runner error: task failed as requested" };
  }
  return {
    ok: true,
    markdown: `# Result\n\nOutput for: ${prompt.slice(0, 100)}`,
    reasoning: "Mock reasoning",
  };
});

const app = createApp({
  port: PORT,
  runBlock: mockRunner,
  tickIntervalMs: 500, // fast ticks for testing
  development: true, // enable HTML import routes for browser navigation
});

console.log(`e2e test server running on port ${app.server.port}`);

// Keep process alive
process.on("SIGINT", () => {
  app.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  app.close();
  process.exit(0);
});
