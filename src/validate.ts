import type {
  CreateBlockInput,
  IntervalUnit,
  PermissionMode,
  RunnerConfig,
} from "./types.ts";

const VALID_UNITS = new Set<IntervalUnit>(["minutes", "hours", "days"]);
const VALID_PERMISSIONS = new Set<PermissionMode>([
  "sandbox",
  "dangerouslySkipPermissions",
]);

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

  const { prompt, intervalValue, intervalUnit, runnerConfig } = body as Record<
    string,
    unknown
  >;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return { field: "prompt", message: "Prompt is required" };
  }

  if (
    typeof intervalValue !== "number" ||
    !Number.isInteger(intervalValue) ||
    intervalValue <= 0
  ) {
    return {
      field: "intervalValue",
      message: "Interval value must be a positive integer",
    };
  }

  if (
    typeof intervalUnit !== "string" ||
    !VALID_UNITS.has(intervalUnit as IntervalUnit)
  ) {
    return { field: "intervalUnit", message: "Invalid interval unit" };
  }

  const parsed = parseRunnerConfig(runnerConfig);

  return {
    prompt: prompt.trim(),
    intervalValue,
    intervalUnit: intervalUnit as IntervalUnit,
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

export function parseRunnerConfig(
  raw: unknown,
  options?: ParseRunnerConfigOptions,
): RunnerConfig | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const { allowCwd = true } = options ?? {};
  const obj = raw as Record<string, unknown>;
  const config: RunnerConfig = {};
  let hasKeys = false;

  if (allowCwd && typeof obj.cwd === "string" && obj.cwd.trim()) {
    config.cwd = obj.cwd.trim();
    hasKeys = true;
  }

  if (typeof obj.model === "string" && obj.model.trim()) {
    config.model = obj.model.trim();
    hasKeys = true;
  }

  if (
    typeof obj.permissions === "string" &&
    VALID_PERMISSIONS.has(obj.permissions as PermissionMode)
  ) {
    config.permissions = obj.permissions as PermissionMode;
    hasKeys = true;
  }

  if (obj.env && typeof obj.env === "object" && !Array.isArray(obj.env)) {
    const env: Record<string, string> = {};
    let envHasKeys = false;
    for (const [key, value] of Object.entries(obj.env)) {
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

  if (typeof obj.timeout === "number" && obj.timeout > 0) {
    config.timeout = obj.timeout;
    hasKeys = true;
  }

  return hasKeys ? config : null;
}
