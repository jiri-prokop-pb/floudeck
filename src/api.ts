import type { Database } from "bun:sqlite";
import { z } from "zod/mini";
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
import type { RunBlockFn, StreamingTryRunFn, TryStreamEvent } from "./types.ts";
import {
  isBlockInputError,
  parseBlockInput,
  parseDisplaySettings,
  parseReorderInput,
  parseRunnerConfig,
  parseTryRunInput,
  safeParseDisplaySettings,
  safeParseRunnerConfig,
} from "./validate.ts";

export type RouterDeps = {
  db: Database;
  sse: SseBroadcaster;
  triggerRun: (blockId: number) => void;
  runAction: RunBlockFn;
  runTry: RunBlockFn;
  streamTry: StreamingTryRunFn;
};

function omitType(event: TryStreamEvent): Record<string, unknown> {
  const { type: _, ...rest } = event;
  return rest;
}

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

function extractBlockTitle(
  block: { output_markdown: string | null } | null,
): string | null {
  if (!block?.output_markdown) return null;
  const match = /^# (.+)$/m.exec(block.output_markdown);
  return match ? match[1].trim() : null;
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

async function parseJsonBody(
  req: Request,
): Promise<{ ok: true; body: unknown } | Response> {
  try {
    const body: unknown = await req.json();
    return { ok: true, body };
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }
}

function requireBlockId(params: Record<string, string>): number | Response {
  const id = Number(params.id);
  if (Number.isNaN(id)) return json({ ok: false, error: "Invalid id" }, 400);
  return id;
}

function requireJsonObject(
  parsed: { ok: true; body: unknown } | Response,
): { config: unknown } | Response {
  if (parsed instanceof Response) return parsed;
  const { body } = parsed;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json(
      { ok: false, error: "Request body must be a JSON object" },
      400,
    );
  }
  // body is a non-null, non-array object — safe to access .config
  const obj = body satisfies object;
  return { config: "config" in obj ? obj.config : undefined };
}

const ActionRunBodySchema = z.object({
  clickId: z.string(),
  blockUuid: z.string(),
  actionName: z.string(),
  params: z.optional(z.record(z.string(), z.string())),
});

function settingsHandlers(
  db: Database,
  key: string,
  safeParse: (raw: string | null) => unknown | undefined,
  parse: (raw: unknown) => unknown | null,
) {
  return {
    get: () => {
      const config = safeParse(getSetting(db, key)) ?? null;
      return json({ ok: true, config });
    },
    post: async (req: Request) => {
      const obj = requireJsonObject(await parseJsonBody(req));
      if (obj instanceof Response) return obj;
      const config = parse(obj.config);
      if (config) {
        setSetting(db, key, JSON.stringify(config));
      } else {
        db.run("DELETE FROM settings WHERE key = ?", key);
      }
      return json({ ok: true, config });
    },
  };
}

export function createRouter(
  deps: RouterDeps,
): (req: Request) => Promise<Response | null> {
  const { db, sse, triggerRun, runAction, streamTry } = deps;

  const runnerSettings = settingsHandlers(
    db,
    "runner_defaults",
    safeParseRunnerConfig,
    (raw) => parseRunnerConfig(raw, { allowCwd: false }),
  );
  const displaySettings = settingsHandlers(
    db,
    "display",
    safeParseDisplaySettings,
    parseDisplaySettings,
  );

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
        const id = requireBlockId(params);
        if (id instanceof Response) return id;
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
        const parsed = await parseJsonBody(req);
        if (parsed instanceof Response) return parsed;
        const input = parseBlockInput(parsed.body);
        if (isBlockInputError(input)) {
          return json({ ok: false, error: input.message }, 400);
        }
        try {
          const block = createBlock(db, input);
          if (!input.tryResult) triggerRun(block.id);
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
        const id = requireBlockId(params);
        if (id instanceof Response) return id;
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
        const id = requireBlockId(params);
        if (id instanceof Response) return id;
        const parsed = await parseJsonBody(req);
        if (parsed instanceof Response) return parsed;
        const input = parseBlockInput(parsed.body);
        if (isBlockInputError(input)) {
          return json({ ok: false, error: input.message }, 400);
        }
        try {
          const block = updateBlock(db, id, input);
          if (!block) return json({ ok: false, error: "Not found" }, 404);
          if (!input.tryResult) triggerRun(block.id);
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
        const id = requireBlockId(params);
        if (id instanceof Response) return id;
        const deleted = deleteBlock(db, id);
        if (!deleted) return json({ ok: false, error: "Not found" }, 404);
        sse.broadcast("blocks-invalidated", {});
        return json({ ok: true });
      },
    },
    {
      method: "POST",
      pattern: "/api/blocks/try",
      handler: async (req) => {
        const parsed = await parseJsonBody(req);
        if (parsed instanceof Response) return parsed;
        const input = parseTryRunInput(parsed.body);
        if (typeof input === "string") {
          return json({ ok: false, error: input }, 400);
        }

        const globalDefaults =
          safeParseRunnerConfig(getSetting(db, "runner_defaults")) ?? null;
        const tryUuid = input.blockUuid ?? crypto.randomUUID();
        const resolvedConfig = resolveRunnerConfig(
          globalDefaults,
          input.runnerConfig ?? null,
          tryUuid,
        );

        const debug = input.debug ?? false;

        // Stream mode: return SSE
        const eventStream = streamTry(input.prompt, resolvedConfig, {
          debug,
          signal: req.signal,
        });

        const sseStream = eventStream.pipeThrough(
          new TransformStream<TryStreamEvent, string>({
            transform(event, controller) {
              const data = JSON.stringify(
                event.type === "debug" ? event.event : omitType(event),
              );
              controller.enqueue(`event: ${event.type}\ndata: ${data}\n\n`);
            },
          }),
        );

        return new Response(sseStream.pipeThrough(new TextEncoderStream()), {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      },
    },
    {
      method: "POST",
      pattern: "/api/blocks/reorder",
      handler: async (req) => {
        const parsed = await parseJsonBody(req);
        if (parsed instanceof Response) return parsed;
        const input = parseReorderInput(parsed.body);
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
      handler: () => runnerSettings.get(),
    },
    {
      method: "POST",
      pattern: "/api/settings/runner",
      handler: (req) => runnerSettings.post(req),
    },
    {
      method: "GET",
      pattern: "/api/settings/display",
      handler: () => displaySettings.get(),
    },
    {
      method: "POST",
      pattern: "/api/settings/display",
      handler: (req) => displaySettings.post(req),
    },
    {
      method: "POST",
      pattern: "/api/actions/run",
      handler: async (req) => {
        const parsed = await parseJsonBody(req);
        if (parsed instanceof Response) return parsed;

        const result = ActionRunBodySchema.safeParse(parsed.body);
        if (!result.success) {
          return json(
            { ok: false, error: "clickId, blockUuid, and actionName required" },
            400,
          );
        }
        const { clickId, blockUuid, actionName, params } = result.data;

        // Check for existing run with this clickId
        const existing = getActionRun(db, clickId);
        if (existing) {
          const existingBlock = getBlockByUuid(db, blockUuid);
          const blockTitle = extractBlockTitle(existingBlock);
          return json({ ok: true, actionRun: existing, blockTitle });
        }

        // Validate block exists
        const block = getBlockByUuid(db, blockUuid);
        if (!block) {
          return json({ ok: false, error: "Block not found" }, 404);
        }

        const paramsObj = params ?? {};
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
            const actionResult = await runAction(prompt, resolvedConfig);
            const completedAt = nowIso();
            if (actionResult.ok) {
              markActionCompleted(
                db,
                clickId,
                actionResult.markdown,
                completedAt,
              );
            } else {
              markActionError(db, clickId, actionResult.error, completedAt);
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

        const blockTitle = extractBlockTitle(block);
        return json({ ok: true, actionRun, blockTitle });
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
        const block = getBlock(db, actionRun.block_id);
        const blockTitle = extractBlockTitle(block);
        return json({ ok: true, actionRun, blockTitle });
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
