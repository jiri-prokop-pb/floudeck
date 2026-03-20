import { existsSync } from "node:fs";
import { join } from "node:path";
import { createRouter } from "./api.ts";
import homepage from "./client/index.html";
import { initDb, resetStaleRunningBlocks } from "./db.ts";
import {
  ensureDataDir,
  getClientAssetsDir,
  getDbPath,
  setDataDir,
} from "./paths.ts";
import { ACTION_SYSTEM_PROMPT, SYSTEM_PROMPT } from "./prompts.ts";
import { createRunner } from "./runner.ts";
import { createScheduler } from "./scheduler.ts";
import { createSseBroadcaster } from "./sse.ts";
import { nowIso } from "./time.ts";
import type { RunBlockFn } from "./types.ts";

const isDev = !!Bun.env.FLOUDECK_DEV;

export type AppOptions = {
  dbPath?: string;
  port?: number;
  clientDir?: string;
  runBlock?: RunBlockFn;
  runAction?: RunBlockFn;
  tickIntervalMs?: number;
  serve?: typeof Bun.serve;
  development?: boolean;
};

export type App = {
  server: ReturnType<typeof Bun.serve>;
  close(): void;
};

/**
 * Serve pre-built client assets for production mode.
 */
function serveStaticAssets(req: Request, clientDir: string): Response | null {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Serve index.html for SPA routes
  if (pathname === "/" || pathname.startsWith("/action/")) {
    const indexPath = join(clientDir, "index.html");
    if (existsSync(indexPath)) {
      return new Response(Bun.file(indexPath), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }

  // Serve static assets (JS, CSS, etc.)
  const filePath = join(clientDir, pathname);
  if (existsSync(filePath)) {
    return new Response(Bun.file(filePath));
  }

  return null;
}

export function createApp(options: AppOptions = {}): App {
  const {
    dbPath,
    port = 3000,
    clientDir: clientDirOverride,
    runBlock = createRunner(SYSTEM_PROMPT),
    runAction = createRunner(ACTION_SYSTEM_PROMPT, "Action"),
    tickIntervalMs = 10_000,
    serve = Bun.serve,
    development = isDev,
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
      scheduler.tick().catch((err) => {
        console.error("scheduler:trigger error", err);
      });
    },
    runAction,
  });

  const clientDir = clientDirOverride ?? getClientAssetsDir();
  const hasClientAssets =
    !development && existsSync(join(clientDir, "index.html"));

  // In dev mode, use Bun's HTML import for routes (enables HMR + Tailwind plugin).
  // In production, serve pre-built static assets via fetch handler.
  const routes = development
    ? { "/": homepage, "/action/*": homepage }
    : undefined;

  const server = serve({
    port,
    development,
    idleTimeout: 255,
    ...(routes ? { routes } : {}),
    async fetch(req) {
      const response = await router(req);
      if (response) return response;

      if (hasClientAssets) {
        const staticResponse = serveStaticAssets(req, clientDir);
        if (staticResponse) return staticResponse;
      } else if (development) {
        // In dev mode, serve static assets from src/client/assets/
        const devAssetsDir = join(import.meta.dir, "client", "assets");
        const devFilePath = join(devAssetsDir, new URL(req.url).pathname);
        if (existsSync(devFilePath)) {
          return new Response(Bun.file(devFilePath));
        }
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

function parseArgs(argv: string[]): {
  port: number | undefined;
  dataDir: string | undefined;
  clientDir: string | undefined;
  version: boolean;
} {
  let port: number | undefined;
  let dataDir: string | undefined;
  let clientDir: string | undefined;
  let version = false;

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--port" && i + 1 < argv.length) {
      port = Number.parseInt(argv[++i], 10);
    } else if (arg === "--data-dir" && i + 1 < argv.length) {
      dataDir = argv[++i];
    } else if (arg === "--client-dir" && i + 1 < argv.length) {
      clientDir = argv[++i];
    } else if (arg === "--version") {
      version = true;
    }
  }

  return { port, dataDir, clientDir, version };
}

async function findDevPort(): Promise<number> {
  for (let port = 3000; port <= 3009; port++) {
    try {
      const server = Bun.serve({ port, fetch: () => new Response("") });
      server.stop();
      return port;
    } catch {
      // port in use, try next
    }
  }
  return 3000;
}

if (import.meta.main) {
  const args = parseArgs(process.argv);

  if (args.version) {
    try {
      const pkg = await Bun.file(
        join(import.meta.dir, "..", "package.json"),
      ).json();
      console.log(pkg.version ?? "0.0.0");
    } catch {
      console.log("0.0.0");
    }
    process.exit(0);
  }

  if (args.dataDir) {
    setDataDir(args.dataDir);
  }

  ensureDataDir();

  let port: number;
  if (args.port !== undefined) {
    port = args.port;
  } else if (isDev) {
    port = await findDevPort();
  } else {
    port = 0;
  }

  createApp({
    dbPath: getDbPath(),
    port,
    clientDir: args.clientDir,
  });
}
