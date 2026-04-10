import { createRouter } from "./api.ts";
import homepage from "./client/index.html";
import {
  checkDatabaseIntegrity,
  findBackups,
  initDb,
  resetStaleRunningBlocks,
} from "./db.ts";
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

export type AppOptions = {
  dbPath?: string;
  port?: number;
  clientDir?: string;
  runBlock?: RunBlockFn;
  runAction?: RunBlockFn;
  runTry?: RunBlockFn;
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
async function serveStaticAssets(
  req: Request,
  clientDir: string,
): Promise<Response | null> {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Serve index.html for SPA routes
  if (
    pathname === "/" ||
    pathname === "/settings" ||
    pathname.startsWith("/action/") ||
    pathname.startsWith("/blocks/")
  ) {
    const indexFile = Bun.file(`${clientDir}/index.html`);
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  }

  // Serve static assets (JS, CSS, etc.)
  const file = Bun.file(`${clientDir}${pathname}`);
  if (await file.exists()) {
    return new Response(file);
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
    runTry = createRunner(SYSTEM_PROMPT, "Try"),
    tickIntervalMs = 10_000,
    serve = Bun.serve,
    development = !clientDirOverride,
  } = options;

  const db = initDb(dbPath);

  if (!checkDatabaseIntegrity(db)) {
    console.warn(
      "server:startup database integrity check failed — UI will show recovery options",
    );
  }

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
    dbPath,
    sse,
    triggerRun: () => {
      scheduler.tick().catch((err) => {
        console.error("scheduler:trigger error", err);
      });
    },
    runAction,
    runTry,
  });

  // In production, resolve client assets dir (explicit flag or next to binary)
  const clientDir = development
    ? null
    : (clientDirOverride ?? getClientAssetsDir());

  // In dev mode, use Bun's HTML import for routes (enables HMR + Tailwind plugin).
  // In production, serve pre-built static assets via fetch handler.
  const routes = development
    ? {
        "/": homepage,
        "/action/*": homepage,
        "/blocks/*": homepage,
        "/settings": homepage,
      }
    : undefined;

  const server = serve({
    port,
    hostname: "127.0.0.1",
    development,
    idleTimeout: 255,
    ...(routes ? { routes } : {}),
    async fetch(req) {
      const response = await router(req);
      if (response) return response;

      if (clientDir) {
        const staticResponse = await serveStaticAssets(req, clientDir);
        if (staticResponse) return staticResponse;
      } else if (development) {
        // In dev mode, serve static assets from src/client/assets/
        const devAssetsDir = `${import.meta.dir}/client/assets`;
        const pathname = new URL(req.url).pathname;
        const devFile = Bun.file(`${devAssetsDir}${pathname}`);
        if (await devFile.exists()) {
          return new Response(devFile);
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

if (import.meta.main) {
  const args = parseArgs(process.argv);

  if (args.version) {
    try {
      const pkg = await Bun.file(`${import.meta.dir}/../package.json`).json();
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

  const port = args.port ?? (args.clientDir ? 0 : 3000);
  const resolvedDbPath = getDbPath();

  try {
    createApp({
      dbPath: resolvedDbPath,
      port,
      clientDir: args.clientDir,
    });
  } catch (err: unknown) {
    console.error("server:startup failed to open database:", err);

    // Check for backups
    const backups = findBackups(resolvedDbPath);
    if (backups.length > 0) {
      console.error(
        `server:startup found ${backups.length} backup(s). Latest: v${backups[0].version}`,
      );
    }

    // Start fresh as last resort
    console.error("server:startup starting with fresh database");
    const { unlinkSync, existsSync } = await import("node:fs");
    for (const suffix of ["", "-wal", "-shm"]) {
      const file = `${resolvedDbPath}${suffix}`;
      if (existsSync(file)) unlinkSync(file);
    }
    createApp({
      dbPath: resolvedDbPath,
      port,
      clientDir: args.clientDir,
    });
  }
}
