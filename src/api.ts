import type { Database } from "bun:sqlite";
import {
  createBlock,
  deleteBlock,
  getBlock,
  listBlocks,
  updateBlock,
} from "./db.ts";
import type { SseBroadcaster } from "./sse.ts";
import { nowIso } from "./time.ts";
import type { IntervalUnit } from "./types.ts";

export type RouterDeps = {
  db: Database;
  sse: SseBroadcaster;
  triggerRun: (blockId: number) => void;
};

const VALID_UNITS = new Set<string>(["minutes", "hours", "days"]);

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
        return json({ ok: true, block });
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
        const { prompt, intervalValue, intervalUnit } = body as Record<
          string,
          unknown
        >;
        if (typeof prompt !== "string" || !prompt.trim()) {
          return json({ ok: false, error: "Prompt is required" }, 400);
        }
        if (
          typeof intervalValue !== "number" ||
          !Number.isInteger(intervalValue) ||
          intervalValue <= 0
        ) {
          return json(
            {
              ok: false,
              error: "Interval value must be a positive integer",
            },
            400,
          );
        }
        if (
          typeof intervalUnit !== "string" ||
          !VALID_UNITS.has(intervalUnit)
        ) {
          return json({ ok: false, error: "Invalid interval unit" }, 400);
        }

        try {
          const block = createBlock(db, {
            prompt: prompt as string,
            intervalValue: intervalValue as number,
            intervalUnit: intervalUnit as IntervalUnit,
          });
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
        const { prompt, intervalValue, intervalUnit } = body as Record<
          string,
          unknown
        >;
        if (typeof prompt !== "string" || !prompt.trim()) {
          return json({ ok: false, error: "Prompt is required" }, 400);
        }
        if (
          typeof intervalValue !== "number" ||
          !Number.isInteger(intervalValue) ||
          intervalValue <= 0
        ) {
          return json(
            {
              ok: false,
              error: "Interval value must be a positive integer",
            },
            400,
          );
        }
        if (
          typeof intervalUnit !== "string" ||
          !VALID_UNITS.has(intervalUnit)
        ) {
          return json({ ok: false, error: "Invalid interval unit" }, 400);
        }
        try {
          const block = updateBlock(db, id, {
            prompt: prompt as string,
            intervalValue: intervalValue as number,
            intervalUnit: intervalUnit as IntervalUnit,
          });
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
