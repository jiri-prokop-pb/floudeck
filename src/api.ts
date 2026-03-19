import type { Database } from "bun:sqlite";
import { formatCliCommand, resolveRunnerConfig } from "./config.ts";
import {
  createActionRun,
  createBlock,
  deleteBlock,
  getActionRun,
  getBlock,
  getBlockByUuid,
  getSetting,
  listBlocks,
  markActionCompleted,
  markActionError,
  parseBlockRunnerConfig,
  reorderBlocks,
  setSetting,
  updateBlock,
} from "./db.ts";
import { composeActionPrompt } from "./prompts.ts";
import type { SseBroadcaster } from "./sse.ts";
import { nowIso } from "./time.ts";
import type { RunBlockFn } from "./types.ts";
import {
  isBlockInputError,
  parseBlockInput,
  parseDisplaySettings,
  parseReorderInput,
  parseRunnerConfig,
  safeParseDisplaySettings,
  safeParseRunnerConfig,
} from "./validate.ts";

export type RouterDeps = {
  db: Database;
  sse: SseBroadcaster;
  triggerRun: (blockId: number) => void;
  runAction: RunBlockFn;
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
    const pp = patternParts[i] ?? "";
    const pathPart = pathParts[i] ?? "";
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
  const { db, sse, triggerRun, runAction } = deps;

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
        const globalDefaults =
          safeParseRunnerConfig(getSetting(db, "runner_defaults")) ?? null;
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
        const updated = getBlock(db, id);
        if (!updated) return json({ ok: false, error: "Not found" }, 404);
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
      method: "POST",
      pattern: "/api/blocks/reorder",
      handler: async (req) => {
        let body: unknown;
        try {
          body = await req.json();
        } catch {
          return json({ ok: false, error: "Invalid JSON" }, 400);
        }
        const input = parseReorderInput(body);
        if (!input) {
          return json({ ok: false, error: "Invalid reorder input" }, 400);
        }
        reorderBlocks(db, input.orderedIds);
        sse.broadcast("blocks-invalidated", {});
        return json({ ok: true });
      },
    },
    {
      method: "GET",
      pattern: "/api/settings/runner",
      handler: () => {
        const config =
          safeParseRunnerConfig(getSetting(db, "runner_defaults")) ?? null;
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
        const config = parseRunnerConfig(rawConfig, { allowCwd: false });
        if (config) {
          setSetting(db, "runner_defaults", JSON.stringify(config));
        } else {
          // Clear settings if empty/null
          db.run("DELETE FROM settings WHERE key = ?", "runner_defaults");
        }
        return json({ ok: true, config });
      },
    },
    {
      method: "GET",
      pattern: "/api/settings/display",
      handler: () => {
        const config =
          safeParseDisplaySettings(getSetting(db, "display")) ?? null;
        return json({ ok: true, config });
      },
    },
    {
      method: "POST",
      pattern: "/api/settings/display",
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
        const config = parseDisplaySettings(rawConfig);
        if (config) {
          setSetting(db, "display", JSON.stringify(config));
        } else {
          db.run("DELETE FROM settings WHERE key = ?", "display");
        }
        return json({ ok: true, config });
      },
    },
    {
      method: "POST",
      pattern: "/api/actions/run",
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
        const { clickId, blockUuid, actionName, params } = body as Record<
          string,
          unknown
        >;
        if (
          typeof clickId !== "string" ||
          typeof blockUuid !== "string" ||
          typeof actionName !== "string"
        ) {
          return json(
            { ok: false, error: "clickId, blockUuid, and actionName required" },
            400,
          );
        }

        // Check for existing run with this clickId
        const existing = getActionRun(db, clickId);
        if (existing) {
          return json({ ok: true, actionRun: existing });
        }

        // Validate block exists
        const block = getBlockByUuid(db, blockUuid);
        if (!block) {
          return json({ ok: false, error: "Block not found" }, 404);
        }

        const paramsObj =
          params && typeof params === "object"
            ? (params as Record<string, string>)
            : {};
        const paramsJson =
          Object.keys(paramsObj).length > 0 ? JSON.stringify(paramsObj) : null;

        const now = nowIso();
        const actionRun = createActionRun(
          db,
          clickId,
          block.id,
          actionName,
          paramsJson,
          now,
        );

        // Spawn action run asynchronously
        const blockOutput = block.output_markdown ?? "";
        const prompt = composeActionPrompt(
          blockOutput,
          actionName,
          paramsObj,
          block.uuid,
        );

        const blockConfig = parseBlockRunnerConfig(block);
        const globalDefaults =
          safeParseRunnerConfig(getSetting(db, "runner_defaults")) ?? null;
        const resolvedConfig = resolveRunnerConfig(
          globalDefaults,
          blockConfig,
          block.uuid,
        );

        // Fire and forget — SSE will notify when done
        void (async () => {
          try {
            const result = await runAction(prompt, resolvedConfig);
            const completedAt = nowIso();
            if (result.ok) {
              markActionCompleted(db, clickId, result.markdown, completedAt);
            } else {
              markActionError(db, clickId, result.error, completedAt);
            }
          } catch (err: unknown) {
            const message =
              err instanceof Error ? err.message : "Unknown action error";
            markActionError(db, clickId, message, nowIso());
          }
          const updated = getActionRun(db, clickId);
          if (updated) {
            sse.broadcast("action-updated", {
              clickId,
              status: updated.status,
            });
          }
        })();

        return json({ ok: true, actionRun });
      },
    },
    {
      method: "GET",
      pattern: "/api/actions/:clickId",
      handler: (_req, params) => {
        const actionRun = getActionRun(db, params.clickId ?? "");
        if (!actionRun) {
          return json({ ok: false, error: "Not found" }, 404);
        }
        return json({ ok: true, actionRun });
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
