import type { RunBlockFn } from "./types.ts";
import { initDb, resetStaleRunningBlocks } from "./db.ts";
import { nowIso } from "./time.ts";
import { createSseBroadcaster } from "./sse.ts";
import { createRouter } from "./api.ts";
import { createScheduler } from "./scheduler.ts";
import { createCliRunner } from "./runner.ts";

export type AppOptions = {
  dbPath?: string;
  port?: number;
  runBlock?: RunBlockFn;
  tickIntervalMs?: number;
};

export type App = {
  server: ReturnType<typeof Bun.serve>;
  close(): void;
};

export function createApp(options: AppOptions = {}): App {
  const {
    dbPath,
    port = 3000,
    runBlock = createCliRunner(),
    tickIntervalMs = 10_000,
  } = options;

  const db = initDb(dbPath);
  const resetCount = resetStaleRunningBlocks(db, nowIso());
  if (resetCount > 0) {
    console.log(`db:init reset ${resetCount} stale running blocks`);
  }

  const sse = createSseBroadcaster();
  const scheduler = createScheduler({
    db,
    sse,
    runBlock,
    tickIntervalMs,
    maxConcurrency: 2,
  });

  const router = createRouter({
    db,
    sse,
    triggerRun: () => {
      // Fire a tick soon to pick up the new/refreshed block
      scheduler.tick().catch((err) => {
        console.error("scheduler:trigger error", err);
      });
    },
  });

  const server = Bun.serve({
    port,
    async fetch(req) {
      const response = await router(req);
      if (response) return response;

      // Serve frontend
      const url = new URL(req.url);
      if (url.pathname === "/" || url.pathname === "/index.html") {
        return new Response(Bun.file("src/client/index.html"));
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  scheduler.start();
  console.log(`server:start listening on port ${server.port}`);

  function close() {
    scheduler.stop();
    sse.close();
    server.stop();
    db.close();
  }

  return { server, close };
}

if (import.meta.main) {
  createApp({ dbPath: "data/floudeck.sqlite" });
}
