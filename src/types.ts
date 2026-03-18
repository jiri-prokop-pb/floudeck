import { z } from "zod/mini";

export type IntervalUnit = "minutes" | "hours" | "days";
export type BlockStatus = "idle" | "running" | "success" | "error";
export type PermissionMode = "default" | "dangerouslySkipPermissions";

export const ENV_INHERIT_SENTINEL = "$__FLOUDECK_INHERIT__";

export const RunnerConfigSchema = z.object({
  cwd: z.optional(z.string()),
  model: z.optional(z.string()),
  permissions: z.optional(z.enum(["default", "dangerouslySkipPermissions"])),
  env: z.optional(z.record(z.string(), z.string())),
  timeout: z.optional(z.number()),
});

export type RunnerConfig = z.infer<typeof RunnerConfigSchema>;

export function safeParseRunnerConfig(raw: string): RunnerConfig | null {
  try {
    const result = RunnerConfigSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export type ResolvedRunnerConfig = {
  cwd: string;
  model: string;
  permissions: PermissionMode;
  env: Record<string, string>;
  timeout: number;
};

export type BlockRecord = {
  id: number;
  uuid: string;
  prompt: string;
  interval_value: number;
  interval_unit: IntervalUnit;
  status: BlockStatus;
  output_markdown: string | null;
  error_text: string | null;
  runner_config: string | null;
  created_at: string;
  updated_at: string;
  last_run_at: string | null;
  next_run_at: string | null;
  running_started_at: string | null;
};

export type CreateBlockInput = {
  prompt: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  runnerConfig?: RunnerConfig;
};

export type UpdateBlockInput = {
  prompt: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  runnerConfig?: RunnerConfig;
};

export type RunResult =
  | { ok: true; markdown: string; reasoning: string | null }
  | { ok: false; error: string; stderr?: string };

export type RunBlockFn = (
  prompt: string,
  config: ResolvedRunnerConfig,
) => Promise<RunResult>;
