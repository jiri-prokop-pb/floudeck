import { SYSTEM_PROMPT } from "./prompts.ts";
import { extractHtmlFromOutput, sanitizeBlockHtml } from "./sanitize.ts";
import type { RunBlockFn, RunResult } from "./types.ts";

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
    const args = [
      "claude",
      "--print",
      "--dangerously-skip-permissions",
      "--append-system-prompt",
      SYSTEM_PROMPT,
      prompt,
    ];

    console.log(
      `run:spawn cwd=${process.cwd()} cmd=claude --print --dangerously-skip-permissions --append-system-prompt <SYSTEM_PROMPT> "${prompt.slice(0, 80)}..."`,
    );

    const proc = Bun.spawn(args, {
      stdout: "pipe",
      stderr: "pipe",
    });

    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      try {
        console.log(`run:timeout killing process after ${RUN_TIMEOUT_MS}ms`);
        proc.kill();
      } catch {
        // ignore
      }
    }, RUN_TIMEOUT_MS);

    try {
      const stdout = await new Response(proc.stdout).text();
      const stderr = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      clearTimeout(timeout);

      console.log(
        `run:exited code=${exitCode} stdout=${stdout.length}b stderr=${stderr.length}b timedOut=${timedOut}`,
      );
      if (stderr.trim()) {
        console.log(`run:stderr ${stderr.trim().slice(0, 300)}`);
      }
      if (stdout.length > 0) {
        console.log(`run:stdout-preview ${stdout.slice(0, 300)}`);
      }

      if (timedOut) {
        return {
          ok: false,
          error: `Task timed out after ${RUN_TIMEOUT_MS / 1000} seconds.`,
          stderr,
        };
      }

      const result = processCliOutput(stdout, stderr, exitCode);
      console.log(
        `run:result ok=${result.ok}${result.ok ? ` html=${result.html.length}b` : ` error=${result.error}`}`,
      );
      return result;
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
