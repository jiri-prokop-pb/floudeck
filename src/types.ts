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
  position: number;
};

export type CreateBlockInput = {
  prompt: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  runnerConfig?: RunnerConfig;
  tryResult?: string;
};

export type UpdateBlockInput = {
  prompt: string;
  intervalValue: number;
  intervalUnit: IntervalUnit;
  runnerConfig?: RunnerConfig;
  tryResult?: string;
};

export type RunResult =
  | { ok: true; markdown: string; reasoning: string | null }
  | { ok: false; error: string; stderr?: string };

export const DisplaySettingsSchema = z.object({
  dateFormat: z.optional(z.enum(["D. M.", "MM-DD", "DD/MM", "MM/DD"])),
  timeFormat: z.optional(z.enum(["24h", "12h"])),
  compactMode: z.optional(z.boolean()),
});

export type DisplaySettings = z.infer<typeof DisplaySettingsSchema>;

export type ActionRunStatus = "pending" | "running" | "completed" | "error";

export const ActionRunSchema = z.object({
  id: z.number(),
  click_id: z.string(),
  block_id: z.number(),
  action_name: z.string(),
  params: z.optional(z.nullable(z.string())),
  status: z.enum(["pending", "running", "completed", "error"]),
  output_markdown: z.optional(z.nullable(z.string())),
  error_text: z.optional(z.nullable(z.string())),
  created_at: z.string(),
  completed_at: z.optional(z.nullable(z.string())),
});

export type ActionRun = {
  id: number;
  click_id: string;
  block_id: number;
  action_name: string;
  params: string | null;
  status: ActionRunStatus;
  output_markdown: string | null;
  error_text: string | null;
  created_at: string;
  completed_at: string | null;
};

export type RunBlockFn = (
  prompt: string,
  config: ResolvedRunnerConfig,
) => Promise<RunResult>;
