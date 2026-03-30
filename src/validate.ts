import { z } from "zod/mini";
import type {
  CreateActionBlockInput,
  CreateBlockInput,
  DisplaySettings,
  RunnerConfig,
} from "./types.ts";
import {
  ActionDefinitionSchema,
  DisplaySettingsSchema,
  RunnerConfigSchema,
} from "./types.ts";

const VALID_UNITS = ["minutes", "hours", "days"] as const;

const BlockInputSchema = z.object({
  prompt: z.string(),
  intervalValue: z.number(),
  intervalUnit: z.enum(VALID_UNITS),
  runnerConfig: z.optional(z.unknown()),
  tryResult: z.optional(z.string()),
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

  const { prompt, intervalValue, intervalUnit, runnerConfig, tryResult } =
    result.data;

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
    ...(tryResult?.trim() ? { tryResult: tryResult.trim() } : {}),
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

const ReorderInputSchema = z.object({
  orderedIds: z.array(z.number()),
});

export function parseReorderInput(
  body: unknown,
): { orderedIds: number[] } | null {
  if (!body || typeof body !== "object") return null;
  const result = ReorderInputSchema.safeParse(body);
  if (!result.success) return null;
  if (result.data.orderedIds.length === 0) return null;
  return { orderedIds: result.data.orderedIds };
}

export type TryRunInput = { prompt: string; runnerConfig?: RunnerConfig };

const TryRunInputSchema = z.object({
  prompt: z.string(),
  runnerConfig: z.optional(z.unknown()),
});

export function parseTryRunInput(body: unknown): TryRunInput | string {
  if (!body || typeof body !== "object") {
    return "Request body must be a JSON object";
  }

  const result = TryRunInputSchema.safeParse(body);
  if (!result.success) {
    return "prompt is required";
  }

  const { prompt, runnerConfig } = result.data;
  if (!prompt.trim()) {
    return "prompt is required";
  }

  const parsed = parseRunnerConfig(runnerConfig);
  return {
    prompt: prompt.trim(),
    ...(parsed ? { runnerConfig: parsed } : {}),
  };
}

export function safeParseDisplaySettings(
  raw: string | null,
): DisplaySettings | undefined {
  if (!raw) return undefined;
  try {
    const result = DisplaySettingsSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : undefined;
  } catch {
    return undefined;
  }
}

// --- Action Block Validation ---

const ACTION_NAME_RE = /^[a-z0-9][a-z0-9-]*$/;

export type ActionBlockInputError = {
  field: string;
  message: string;
};

export function isActionBlockInput(body: unknown): boolean {
  return (
    !!body &&
    typeof body === "object" &&
    "blockType" in body &&
    (body as Record<string, unknown>).blockType === "action"
  );
}

export function parseActionBlockInput(
  body: unknown,
): CreateActionBlockInput | ActionBlockInputError {
  if (!body || typeof body !== "object") {
    return { field: "actions", message: "Request body must be a JSON object" };
  }

  const obj = body as Record<string, unknown>;

  // Parse actions array
  if (!Array.isArray(obj.actions) || obj.actions.length === 0) {
    return {
      field: "actions",
      message: "At least one action is required",
    };
  }

  const actions = [];
  const names = new Set<string>();
  for (let i = 0; i < obj.actions.length; i++) {
    const r = ActionDefinitionSchema.safeParse(obj.actions[i]);
    if (!r.success) {
      return {
        field: `actions[${i}]`,
        message: "Invalid action definition",
      };
    }
    const action = r.data;
    if (!action.name.trim()) {
      return {
        field: `actions[${i}].name`,
        message: "Action name is required",
      };
    }
    if (!ACTION_NAME_RE.test(action.name)) {
      return {
        field: `actions[${i}].name`,
        message:
          "Action name must be URL-safe (lowercase letters, numbers, hyphens)",
      };
    }
    if (names.has(action.name)) {
      return {
        field: `actions[${i}].name`,
        message: `Duplicate action name: ${action.name}`,
      };
    }
    names.add(action.name);
    if (!action.label.trim()) {
      return {
        field: `actions[${i}].label`,
        message: "Action label is required",
      };
    }
    if (!action.prompt.trim()) {
      return {
        field: `actions[${i}].prompt`,
        message: "Action prompt is required",
      };
    }
    actions.push(action);
  }

  const parsed = parseRunnerConfig(obj.runnerConfig);
  const title =
    typeof obj.title === "string" && obj.title.trim()
      ? obj.title.trim()
      : undefined;

  return {
    blockType: "action",
    title,
    actions,
    ...(parsed ? { runnerConfig: parsed } : {}),
  };
}

export function isActionBlockInputError(
  result: CreateActionBlockInput | ActionBlockInputError,
): result is ActionBlockInputError {
  return "field" in result;
}

export function parseDisplaySettings(raw: unknown): DisplaySettings | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const result = DisplaySettingsSchema.safeParse(raw);
  if (!result.success) return null;

  const config: DisplaySettings = {};
  let hasKeys = false;

  if (result.data.dateFormat) {
    config.dateFormat = result.data.dateFormat;
    hasKeys = true;
  }
  if (result.data.timeFormat) {
    config.timeFormat = result.data.timeFormat;
    hasKeys = true;
  }
  if (typeof result.data.compactMode === "boolean") {
    config.compactMode = result.data.compactMode;
    hasKeys = true;
  }

  return hasKeys ? config : null;
}
