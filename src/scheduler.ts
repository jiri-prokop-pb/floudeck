import type { Database } from "bun:sqlite";
import {
  findDueBlocks,
  getBlock,
  markBlockError,
  markBlockRunning,
  markBlockSuccess,
} from "./db.ts";
import type { SseBroadcaster } from "./sse.ts";
import { addInterval, nowIso } from "./time.ts";
import type { RunBlockFn } from "./types.ts";

export type SchedulerDeps = {
  db: Database;
  sse: SseBroadcaster;
  runBlock: RunBlockFn;
  tickIntervalMs?: number;
  maxConcurrency?: number;
};

export type Scheduler = {
  start(): void;
  stop(): void;
  tick(): Promise<void>;
  getState(): { activeRuns: number; runningBlockIds: Set<number> };
};

export function createScheduler(deps: SchedulerDeps): Scheduler {
  const {
    db,
    sse,
    runBlock,
    tickIntervalMs = 10_000,
    maxConcurrency = 2,
  } = deps;

  const runningBlockIds = new Set<number>();
  let activeRuns = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  async function startRun(
    blockId: number,
    prompt: string,
    intervalValue: number,
    intervalUnit: "minutes" | "hours" | "days",
  ): Promise<void> {
    runningBlockIds.add(blockId);
    activeRuns++;

    try {
      const startedAt = nowIso();
      console.log(
        `scheduler:run:start block=${blockId} prompt="${prompt.slice(0, 60)}..." activeRuns=${activeRuns}`,
      );
      markBlockRunning(db, blockId, startedAt);
      sse.broadcast("block-updated", { blockId, status: "running" });

      const result = await runBlock(prompt);
      const finishedAt = nowIso();
      const nextRunAt = addInterval(finishedAt, intervalValue, intervalUnit);

      // Check if block still exists
      const block = getBlock(db, blockId);
      if (!block) {
        console.log(`scheduler:run:orphan block=${blockId} was deleted during run`);
        return;
      }

      if (result.ok) {
        console.log(
          `scheduler:run:success block=${blockId} html=${result.html.length}b nextRun=${nextRunAt}`,
        );
        markBlockSuccess(db, blockId, result.html, finishedAt, nextRunAt);
        sse.broadcast("block-updated", { blockId, status: "success" });
      } else {
        console.log(
          `scheduler:run:error block=${blockId} error="${result.error}" nextRun=${nextRunAt}`,
        );
        markBlockError(db, blockId, result.error, finishedAt, nextRunAt);
        sse.broadcast("block-updated", { blockId, status: "error" });
      }
    } catch (err: unknown) {
      const block = getBlock(db, blockId);
      if (!block) return;

      const finishedAt = nowIso();
      const nextRunAt = addInterval(finishedAt, intervalValue, intervalUnit);
      const message =
        err instanceof Error ? err.message : "Unknown runner error";
      console.error(
        `scheduler:run:exception block=${blockId} error="${message}"`,
      );
      markBlockError(db, blockId, message, finishedAt, nextRunAt);
      sse.broadcast("block-updated", { blockId, status: "error" });
    } finally {
      runningBlockIds.delete(blockId);
      activeRuns--;
      console.log(
        `scheduler:run:done block=${blockId} activeRuns=${activeRuns}`,
      );
    }
  }

  async function tick(): Promise<void> {
    if (activeRuns >= maxConcurrency) {
      console.log(`scheduler:tick skipped (at max concurrency ${maxConcurrency})`);
      return;
    }

    const capacity = maxConcurrency - activeRuns;
    const now = nowIso();
    const dueBlocks = findDueBlocks(db, now, capacity);

    if (dueBlocks.length > 0) {
      console.log(
        `scheduler:tick found ${dueBlocks.length} due blocks (capacity=${capacity})`,
      );
    }

    const promises: Promise<void>[] = [];
    for (const block of dueBlocks) {
      if (runningBlockIds.has(block.id)) continue;
      if (activeRuns >= maxConcurrency) break;
      promises.push(
        startRun(
          block.id,
          block.prompt,
          block.interval_value,
          block.interval_unit,
        ),
      );
    }

    await Promise.all(promises);
  }

  function start(): void {
    if (timer) return;
    timer = setInterval(() => {
      tick().catch((err) => {
        console.error("scheduler:tick error", err);
      });
    }, tickIntervalMs);
  }

  function stop(): void {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function getState() {
    return { activeRuns, runningBlockIds: new Set(runningBlockIds) };
  }

  return { start, stop, tick, getState };
}
