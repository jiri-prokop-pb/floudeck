import type { Database } from "bun:sqlite";
import {
  findDueBlocks,
  getBlock,
  markBlockError,
  markBlockPendingImmediateRun,
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

  function wasUpdatedDuringRun(updatedAt: string, startedAt: string): boolean {
    return new Date(updatedAt).getTime() > new Date(startedAt).getTime();
  }

  async function startRun(blockId: number, prompt: string): Promise<void> {
    runningBlockIds.add(blockId);
    activeRuns++;
    const startedAt = nowIso();
    let shouldRerun = false;

    try {
      markBlockRunning(db, blockId, startedAt);
      sse.broadcast("block-updated", { blockId, status: "running" });

      const result = await runBlock(prompt);

      const block = getBlock(db, blockId);
      if (!block) return;
      if (wasUpdatedDuringRun(block.updated_at, startedAt)) {
        const finishedAt = nowIso();
        markBlockPendingImmediateRun(db, blockId, finishedAt);
        shouldRerun = true;
        return;
      }

      const finishedAt = nowIso();
      const nextRunAt = addInterval(
        finishedAt,
        block.interval_value,
        block.interval_unit,
      );

      if (result.ok) {
        markBlockSuccess(db, blockId, result.markdown, finishedAt, nextRunAt);
        sse.broadcast("block-updated", { blockId, status: "success" });
      } else {
        markBlockError(db, blockId, result.error, finishedAt, nextRunAt);
        sse.broadcast("block-updated", { blockId, status: "error" });
      }
    } catch (err: unknown) {
      const block = getBlock(db, blockId);
      if (!block) return;
      if (wasUpdatedDuringRun(block.updated_at, startedAt)) {
        const finishedAt = nowIso();
        markBlockPendingImmediateRun(db, blockId, finishedAt);
        shouldRerun = true;
        return;
      }

      const finishedAt = nowIso();
      const nextRunAt = addInterval(
        finishedAt,
        block.interval_value,
        block.interval_unit,
      );
      const message =
        err instanceof Error ? err.message : "Unknown runner error";
      markBlockError(db, blockId, message, finishedAt, nextRunAt);
      sse.broadcast("block-updated", { blockId, status: "error" });
    } finally {
      runningBlockIds.delete(blockId);
      activeRuns--;
      if (shouldRerun) {
        await tick();
      }
    }
  }

  async function tick(): Promise<void> {
    if (activeRuns >= maxConcurrency) return;

    const capacity = maxConcurrency - activeRuns;
    const now = nowIso();
    const dueBlocks = findDueBlocks(db, now, capacity);

    const promises: Promise<void>[] = [];
    for (const block of dueBlocks) {
      if (runningBlockIds.has(block.id)) continue;
      if (activeRuns >= maxConcurrency) break;
      promises.push(startRun(block.id, block.prompt));
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
