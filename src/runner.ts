import { buildCliArgs, ensureCwd } from "./config.ts";
import { extractMarkdownFromOutput } from "./extract.ts";
import type { ResolvedRunnerConfig, RunBlockFn, RunResult } from "./types.ts";

export function processCliOutput(
  stdout: string,
  stderr: string,
  exitCode: number,
): RunResult {
  if (exitCode !== 0) {
    const message = stderr.trim()
      ? `CLI exited with code ${exitCode}: ${stderr.trim().slice(0, 200)}`
      : `CLI exited with code ${exitCode}`;
    return { ok: false, error: message, stderr };
  }

  const { markdown, reasoning } = extractMarkdownFromOutput(stdout);

  if (!markdown) {
    return { ok: false, error: "Task returned no markdown output.", stderr };
  }

  return { ok: true, markdown, reasoning };
}

function buildSpawnEnv(
  config: ResolvedRunnerConfig,
): Record<string, string | undefined> | undefined {
  const hasCustomEnv = Object.keys(config.env).length > 0;
  if (config.permissions === "dangerouslySkipPermissions") {
    return hasCustomEnv ? { ...process.env, ...config.env } : undefined;
  }
  if (hasCustomEnv) {
    return {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      ...config.env,
    };
  }
  return undefined;
}

export function createRunner(
  systemPrompt: string,
  label = "Task",
): RunBlockFn {
  return async (
    prompt: string,
    config: ResolvedRunnerConfig,
  ): Promise<RunResult> => {
    const args = buildCliArgs(config, prompt, systemPrompt);
    const timeoutMs = config.timeout * 1000;

    ensureCwd(config.cwd);

    const spawnEnv = buildSpawnEnv(config);
    const proc = Bun.spawn(args, {
      cwd: config.cwd,
      stdout: "pipe",
      stderr: "pipe",
      ...(spawnEnv ? { env: spawnEnv } : {}),
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);

    try {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      clearTimeout(timeout);

      if (timedOut) {
        return {
          ok: false,
          error: `${label} timed out after ${config.timeout} seconds.`,
          stderr,
        };
      }

      return processCliOutput(stdout, stderr, exitCode);
    } finally {
      clearTimeout(timeout);
    }
  };
}

export function createMockRunner(
  handler: (
    prompt: string,
    config: ResolvedRunnerConfig,
  ) => RunResult | Promise<RunResult>,
): RunBlockFn {
  return async (
    prompt: string,
    config: ResolvedRunnerConfig,
  ): Promise<RunResult> => {
    return handler(prompt, config);
  };
}
