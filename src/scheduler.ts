import type { Database } from "bun:sqlite";
import { resolveRunnerConfig } from "./config.ts";
import {
  findDueBlocks,
  getBlock,
  getSetting,
  markBlockError,
  markBlockPendingImmediateRun,
  markBlockRunning,
  markBlockSuccess,
  parseBlockRunnerConfig,
} from "./db.ts";
import type { SseBroadcaster } from "./sse.ts";
import { addInterval, nowIso } from "./time.ts";
import type { RunBlockFn } from "./types.ts";
import { safeParseRunnerConfig } from "./types.ts";

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

  function loadGlobalDefaults() {
    const raw = getSetting(db, "runner_defaults");
    if (!raw) return null;
    return safeParseRunnerConfig(raw);
  }

  async function startRun(blockId: number, prompt: string): Promise<void> {
    runningBlockIds.add(blockId);
    activeRuns++;
    const startedAt = nowIso();
    let shouldRerun = false;

    try {
      const currentBlock = getBlock(db, blockId);
      if (!currentBlock) return;

      const blockConfig = parseBlockRunnerConfig(currentBlock);
      const globalDefaults = loadGlobalDefaults();
      const resolvedConfig = resolveRunnerConfig(
        globalDefaults,
        blockConfig,
        currentBlock.uuid,
      );

      markBlockRunning(db, blockId, startedAt);
      sse.broadcast("block-updated", { blockId, status: "running" });

      const result = await runBlock(prompt, resolvedConfig);

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
