import { z } from "zod/mini";
import type { CreateBlockInput, RunnerConfig } from "./types.ts";
import { RunnerConfigSchema } from "./types.ts";

const VALID_UNITS = ["minutes", "hours", "days"] as const;

const BlockInputSchema = z.object({
  prompt: z.string(),
  intervalValue: z.number(),
  intervalUnit: z.enum(VALID_UNITS),
  runnerConfig: z.optional(z.unknown()),
});

export type BlockInputError = {
  field: "prompt" | "intervalValue" | "intervalUnit";
  message: string;
};

export function parseBlockInput(
  body: unknown,
): CreateBlockInput | BlockInputError {
  if (!body || typeof body !== "object") {
    return { field: "prompt", message: "Request body must be a JSON object" };
  }

  const result = BlockInputSchema.safeParse(body);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path[0];
    if (path === "intervalUnit") {
      return { field: "intervalUnit", message: "Invalid interval unit" };
    }
    if (path === "intervalValue") {
      return {
        field: "intervalValue",
        message: "Interval value must be a positive integer",
      };
    }
    if (path === "prompt") {
      return { field: "prompt", message: "Prompt is required" };
    }
    return { field: "prompt", message: "Invalid input" };
  }

  const { prompt, intervalValue, intervalUnit, runnerConfig } = result.data;

  if (!prompt.trim()) {
    return { field: "prompt", message: "Prompt is required" };
  }

  if (!Number.isInteger(intervalValue) || intervalValue <= 0) {
    return {
      field: "intervalValue",
      message: "Interval value must be a positive integer",
    };
  }

  const parsed = parseRunnerConfig(runnerConfig);

  return {
    prompt: prompt.trim(),
    intervalValue,
    intervalUnit,
    ...(parsed ? { runnerConfig: parsed } : {}),
  };
}

export function isBlockInputError(
  result: CreateBlockInput | BlockInputError,
): result is BlockInputError {
  return "field" in result;
}

export type ParseRunnerConfigOptions = {
  allowCwd?: boolean;
};

// Lenient schema for parseRunnerConfig — env accepts unknown values so we can
// filter non-strings manually (matching the original lenient parsing behavior).
const LenientRunnerConfigSchema = z.object({
  cwd: z.optional(z.string()),
  model: z.optional(z.string()),
  permissions: z.optional(z.enum(["default", "dangerouslySkipPermissions"])),
  env: z.optional(z.record(z.string(), z.unknown())),
  timeout: z.optional(z.number()),
});

export function parseRunnerConfig(
  raw: unknown,
  options?: ParseRunnerConfigOptions,
): RunnerConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const { allowCwd = true } = options ?? {};
  const result = LenientRunnerConfigSchema.safeParse(raw);
  if (!result.success) return null;

  const config: RunnerConfig = {};
  let hasKeys = false;

  if (allowCwd && result.data.cwd?.trim()) {
    config.cwd = result.data.cwd.trim();
    hasKeys = true;
  }

  if (result.data.model?.trim()) {
    config.model = result.data.model.trim();
    hasKeys = true;
  }

  if (result.data.permissions) {
    config.permissions = result.data.permissions;
    hasKeys = true;
  }

  if (result.data.env && typeof result.data.env === "object") {
    const env: Record<string, string> = {};
    let envHasKeys = false;
    for (const [key, value] of Object.entries(result.data.env)) {
      if (typeof value === "string") {
        env[key] = value;
        envHasKeys = true;
      }
    }
    if (envHasKeys) {
      config.env = env;
      hasKeys = true;
    }
  }

  if (result.data.timeout !== undefined && result.data.timeout > 0) {
    config.timeout = result.data.timeout;
    hasKeys = true;
  }

  return hasKeys ? config : null;
}

export function safeParseRunnerConfig(
  raw: string | null,
): RunnerConfig | undefined {
  if (!raw) return undefined;
  try {
    const result = RunnerConfigSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}
