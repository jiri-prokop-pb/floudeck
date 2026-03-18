import type { Database } from "bun:sqlite";
import { formatCliCommand, resolveRunnerConfig } from "./config.ts";
import {
  createBlock,
  deleteBlock,
  getBlock,
  getSetting,
  listBlocks,
  parseBlockRunnerConfig,
  setSetting,
  updateBlock,
} from "./db.ts";
import type { SseBroadcaster } from "./sse.ts";
import { nowIso } from "./time.ts";
import type { RunnerConfig } from "./types.ts";
import {
  isBlockInputError,
  parseBlockInput,
  parseRunnerConfig,
} from "./validate.ts";

export type RouterDeps = {
  db: Database;
  sse: SseBroadcaster;
  triggerRun: (blockId: number) => void;
};

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function matchRoute(
  pathname: string,
  pattern: string,
): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const pathParts = pathname.split("/");
  if (patternParts.length !== pathParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i]!;
    const pathPart = pathParts[i]!;
    if (pp.startsWith(":")) {
      params[pp.slice(1)] = pathPart;
    } else if (pp !== pathPart) {
      return null;
    }
  }
  return params;
}

export function createRouter(
  deps: RouterDeps,
): (req: Request) => Promise<Response | null> {
  const { db, sse, triggerRun } = deps;

  const routes: Array<{
    method: string;
    pattern: string;
    handler: (
      req: Request,
      params: Record<string, string>,
    ) => Promise<Response> | Response;
  }> = [
    {
      method: "GET",
      pattern: "/api/blocks",
      handler: () => {
        const blocks = listBlocks(db);
        return json({ ok: true, blocks });
      },
    },
    {
      method: "GET",
      pattern: "/api/blocks/:id",
      handler: (_req, params) => {
        const id = Number(params.id);
        if (Number.isNaN(id))
          return json({ ok: false, error: "Invalid id" }, 400);
        const block = getBlock(db, id);
        if (!block) return json({ ok: false, error: "Not found" }, 404);

        const blockConfig = parseBlockRunnerConfig(block);
        const globalRaw = getSetting(db, "runner_defaults");
        let globalDefaults: RunnerConfig | null = null;
        if (globalRaw) {
          try {
            globalDefaults = JSON.parse(globalRaw) as RunnerConfig;
          } catch {
            // ignore corrupt settings
          }
        }
        const resolvedConfig = resolveRunnerConfig(
          globalDefaults,
          blockConfig,
          block.uuid,
        );
        const cliCommand = formatCliCommand(resolvedConfig, block.prompt);

        return json({ ok: true, block, resolvedConfig, cliCommand });
      },
    },
    {
      method: "GET",
      pattern: "/api/events",
      handler: () => {
        return sse.addClient();
      },
    },
    {
      method: "POST",
      pattern: "/api/blocks",
      handler: async (req) => {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }
        const input = parseBlockInput(body);
        if (isBlockInputError(input)) {
          return json({ ok: false, error: input.message }, 400);
        }
        try {
          const block = createBlock(db, input);
          triggerRun(block.id);
          return json({ ok: true, block }, 201);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to create block";
          return json({ ok: false, error: message }, 400);
        }
      },
    },
    {
      method: "POST",
      pattern: "/api/blocks/:id/refresh",
      handler: (_req, params) => {
        const id = Number(params.id);
        if (Number.isNaN(id))
          return json({ ok: false, error: "Invalid id" }, 400);
        const block = getBlock(db, id);
        if (!block) return json({ ok: false, error: "Not found" }, 404);
        if (block.status === "running") {
          return json({ ok: true, block });
        }
        const now = nowIso();
        db.run(
          "UPDATE blocks SET next_run_at = ?, updated_at = ? WHERE id = ?",
          now,
          now,
          id,
        );
        triggerRun(id);
        const updated = getBlock(db, id)!;
        return json({ ok: true, block: updated });
      },
    },
    {
      method: "POST",
      pattern: "/api/blocks/:id/update",
      handler: async (req, params) => {
        const id = Number(params.id);
        if (Number.isNaN(id))
          return json({ ok: false, error: "Invalid id" }, 400);
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }
        const input = parseBlockInput(body);
        if (isBlockInputError(input)) {
          return json({ ok: false, error: input.message }, 400);
        }
        try {
          const block = updateBlock(db, id, input);
          if (!block) return json({ ok: false, error: "Not found" }, 404);
          triggerRun(block.id);
          return json({ ok: true, block });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Failed to update block";
          return json({ ok: false, error: message }, 400);
        }
      },
    },
    {
      method: "POST",
      pattern: "/api/blocks/:id/delete",
      handler: (_req, params) => {
        const id = Number(params.id);
        if (Number.isNaN(id))
          return json({ ok: false, error: "Invalid id" }, 400);
        const deleted = deleteBlock(db, id);
        if (!deleted) return json({ ok: false, error: "Not found" }, 404);
        sse.broadcast("blocks-invalidated", {});
        return json({ ok: true });
      },
    },
    {
      method: "GET",
      pattern: "/api/settings/runner",
      handler: () => {
        const raw = getSetting(db, "runner_defaults");
        let config: RunnerConfig | null = null;
        if (raw) {
          try {
            config = JSON.parse(raw) as RunnerConfig;
          } catch {
            // ignore corrupt data
          }
        }
        return json({ ok: true, config });
      },
    },
    {
      method: "POST",
      pattern: "/api/settings/runner",
      handler: async (req) => {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }
        if (!body || typeof body !== "object") {
          return json(
            { ok: false, error: "Request body must be a JSON object" },
            400,
          );
        }
        const { config: rawConfig } = body as Record<string, unknown>;
        const config = parseRunnerConfig(rawConfig);
        if (config) {
          setSetting(db, "runner_defaults", JSON.stringify(config));
        } else {
          // Clear settings if empty/null
          db.run("DELETE FROM settings WHERE key = ?", "runner_defaults");
        }
        return json({ ok: true, config });
      },
    },
  ];

  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url);
    for (const route of routes) {
      if (req.method !== route.method) continue;
      const params = matchRoute(url.pathname, route.pattern);
      if (params) return route.handler(req, params);
    }
    return null;
  };
}
