/**
 * Standalone test server for E2E tests.
 * Uses a mock runner and :memory: SQLite so no real CLI calls or disk writes.
 * Starts on the port specified by E2E_PORT.
 */
import { createApp } from "../../src/server.ts";
import { createMockRunner } from "../../src/runner.ts";

const portValue = process.env.E2E_PORT;
if (!portValue) {
  throw new Error("E2E_PORT is required. Run the suite via `bun run e2e`.");
}

const PORT = Number(portValue);
if (!Number.isInteger(PORT) || PORT <= 0) {
  throw new Error(`Invalid E2E_PORT: ${portValue}`);
}

// Mock runner that returns realistic HTML after a short delay
const mockRunner = createMockRunner(async (prompt) => {
  await new Promise((r) => setTimeout(r, 200));
  if (prompt.toLowerCase().includes("fail")) {
    return { ok: false, error: "Mock runner error: task failed as requested" };
  }
  return {
    ok: true,
    html: `<div class="mock-output"><h3 class="text-lg font-semibold">Result</h3><p>Output for: ${prompt.slice(0, 100)}</p></div>`,
    rawHtml: `<div class="mock-output"><h3>Result</h3><p>Output for: ${prompt.slice(0, 100)}</p></div>`,
    reasoning: "Mock reasoning",
  };
});

const app = createApp({
  port: PORT,
  runBlock: mockRunner,
  tickIntervalMs: 500, // fast ticks for testing
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
