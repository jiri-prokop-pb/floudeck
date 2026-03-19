import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { ACTION_SYSTEM_PROMPT, SYSTEM_PROMPT } from "./prompts.ts";
import type { ResolvedRunnerConfig, RunnerConfig } from "./types.ts";
import { ENV_INHERIT_SENTINEL } from "./types.ts";

const WORKSPACE_ROOT = `${homedir()}/.floudeck/blocks-workspace`;

const HARDCODED_DEFAULTS: ResolvedRunnerConfig = {
  cwd: "", // placeholder — resolved per-block via blockUuid
  model: "sonnet",
  permissions: "default",
  env: {},
  timeout: 60,
};

export function resolveRunnerConfig(
  globalDefaults: RunnerConfig | null,
  blockConfig: RunnerConfig | null,
  blockUuid: string,
): ResolvedRunnerConfig {
  const defaults = HARDCODED_DEFAULTS;
  const global = globalDefaults ?? {};
  const block = blockConfig ?? {};

  // cwd: block override or default (global is skipped for cwd)
  const cwd = block.cwd || `${WORKSPACE_ROOT}/${blockUuid}`;

  const model = block.model || global.model || defaults.model;
  const permissions =
    block.permissions || global.permissions || defaults.permissions;
  const timeout = block.timeout ?? global.timeout ?? defaults.timeout;

  // env: merge global + block, then resolve inherit sentinels
  const mergedEnv: Record<string, string> = {
    ...defaults.env,
    ...(global.env ?? {}),
    ...(block.env ?? {}),
  };
  const resolvedEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(mergedEnv)) {
    if (value === ENV_INHERIT_SENTINEL) {
      const envValue = Bun.env[key];
      if (envValue !== undefined) {
        resolvedEnv[key] = envValue;
      }
      // Missing keys are silently omitted
    } else {
      resolvedEnv[key] = value;
    }
  }

  return { cwd, model, permissions, env: resolvedEnv, timeout };
}

export function buildCliArgs(
  config: ResolvedRunnerConfig,
  prompt: string,
): string[] {
  const args = ["claude", "--print"];

  if (config.permissions === "dangerouslySkipPermissions") {
    args.push("--dangerously-skip-permissions");
  }
  // "default" mode: no permission flag — respects user's Claude Code settings
  // (including sandbox if configured via /sandbox or settings.json).

  args.push("--model", config.model);
  args.push("--append-system-prompt", SYSTEM_PROMPT);
  args.push("--", prompt);

  return args;
}

export function buildActionCliArgs(
  config: ResolvedRunnerConfig,
  prompt: string,
): string[] {
  const args = ["claude", "--print"];

  if (config.permissions === "dangerouslySkipPermissions") {
    args.push("--dangerously-skip-permissions");
  }

  args.push("--model", config.model);
  args.push("--append-system-prompt", ACTION_SYSTEM_PROMPT);
  args.push("--", prompt);

  return args;
}

export function ensureCwd(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function formatCliCommand(
  config: ResolvedRunnerConfig,
  prompt: string,
): string {
  const args = buildCliArgs(config, prompt);
  // Truncate prompt for display
  const maxPromptLen = 80;
  const lastIdx = args.length - 1;
  const promptArg = args[lastIdx] ?? "";
  if (promptArg.length > maxPromptLen) {
    args[lastIdx] = `${promptArg.slice(0, maxPromptLen)}...`;
  }
  // Shell-escape each arg for display
  return args.map((a) => (a.includes(" ") ? `'${a}'` : a)).join(" ");
}
