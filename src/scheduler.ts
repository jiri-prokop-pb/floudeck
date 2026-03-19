import type { Database } from "bun:sqlite";
import { resolveRunnerConfig } from "./config.ts";
import {
  cleanupExpiredActionRuns,
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
import { safeParseRunnerConfig } from "./validate.ts";

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
    return safeParseRunnerConfig(getSetting(db, "runner_defaults")) ?? null;
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

      const promptWithContext = `${prompt}\n\n[Block UUID: ${currentBlock.uuid}]`;
      const result = await runBlock(promptWithContext, resolvedConfig);

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

  let lastCleanup = 0;
  const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

  function maybeCleanupActions(): void {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
    lastCleanup = now;
    const cutoff = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const deleted = cleanupExpiredActionRuns(db, cutoff);
    if (deleted > 0) {
      console.log(`scheduler:cleanup deleted ${deleted} expired action runs`);
    }
  }

  async function tick(): Promise<void> {
    maybeCleanupActions();

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
