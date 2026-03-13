import type { RunResult, RunBlockFn } from "./types.ts";
import { SYSTEM_PROMPT } from "./prompts.ts";
import { sanitizeBlockHtml, extractHtmlFromOutput } from "./sanitize.ts";

const RUN_TIMEOUT_MS = 60_000;

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

  const { html: rawHtml, reasoning } = extractHtmlFromOutput(stdout);

  if (!rawHtml) {
    return { ok: false, error: "Task returned no HTML output.", stderr };
  }

  const sanitized = sanitizeBlockHtml(rawHtml);
  if (!sanitized.trim()) {
    return {
      ok: false,
      error: "Task returned invalid or unsafe HTML.",
      stderr,
    };
  }

  return { ok: true, html: sanitized, rawHtml, reasoning };
}

export function createCliRunner(): RunBlockFn {
  return async (prompt: string): Promise<RunResult> => {
    const proc = Bun.spawn(
      ["claude", "--print", "--system-prompt", SYSTEM_PROMPT, prompt],
      {
        stdout: "pipe",
        stderr: "pipe",
      },
    );

    const timeout = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        // ignore
      }
    }, RUN_TIMEOUT_MS);

    try {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      // Check if killed by timeout
      if (proc.killed) {
        return {
          ok: false,
          error: `Task timed out after ${RUN_TIMEOUT_MS / 1000} seconds.`,
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
  handler: (prompt: string) => RunResult | Promise<RunResult>,
): RunBlockFn {
  return async (prompt: string): Promise<RunResult> => {
    return handler(prompt);
  };
}
