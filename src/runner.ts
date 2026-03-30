import { buildCliArgs, buildStreamingCliArgs, ensureCwd } from "./config.ts";
import { extractMarkdownFromOutput } from "./extract.ts";
import { resolveClaudePath } from "./paths.ts";
import type {
  DebugEvent,
  PermissionErrorInfo,
  ResolvedRunnerConfig,
  RunBlockFn,
  RunResult,
  StreamingTryRunFn,
  TryStreamEvent,
} from "./types.ts";

let resolvedClaudePath: string | null = null;

export function getClaudePath(): string {
  if (!resolvedClaudePath) {
    resolvedClaudePath = resolveClaudePath();
  }
  return resolvedClaudePath;
}

export function setClaudePath(path: string): void {
  resolvedClaudePath = path;
}

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

export function createRunner(systemPrompt: string, label = "Task"): RunBlockFn {
  return async (
    prompt: string,
    config: ResolvedRunnerConfig,
  ): Promise<RunResult> => {
    const args = buildCliArgs(config, prompt, systemPrompt, getClaudePath());
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

// --- Streaming Try support ---

const PERMISSION_PATTERNS = [
  /permission\s+(denied|error)/i,
  /not\s+allowed/i,
  /EPERM/,
  /requires\s+permission/i,
  /sandbox.*blocked/i,
];

export function detectPermissionError(
  stderr: string,
  cwd: string,
): PermissionErrorInfo | undefined {
  const isPermError = PERMISSION_PATTERNS.some((p) => p.test(stderr));
  if (!isPermError) return undefined;
  return {
    instructions: `Permission error detected. You can configure allowed tools in ${cwd}/.claude/settings.local.json`,
    cwd,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function parseNdjsonLine(
  line: string,
  debug: boolean,
): TryStreamEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const type = typeof parsed.type === "string" ? parsed.type : undefined;

  // Text content delta
  if (type === "content_block_delta") {
    const delta = isRecord(parsed.delta) ? parsed.delta : undefined;
    if (delta?.type === "text_delta" && typeof delta.text === "string") {
      return { type: "text", text: delta.text };
    }
  }

  // Thinking content
  if (type === "content_block_delta" && debug) {
    const delta = isRecord(parsed.delta) ? parsed.delta : undefined;
    if (
      delta?.type === "thinking_delta" &&
      typeof delta.thinking === "string"
    ) {
      const event: DebugEvent = { kind: "thinking", text: delta.thinking };
      return { type: "debug", event };
    }
  }

  // Tool use
  if (type === "content_block_start" && debug) {
    const contentBlock = isRecord(parsed.content_block)
      ? parsed.content_block
      : undefined;
    if (contentBlock?.type === "tool_use") {
      const tool =
        typeof contentBlock.name === "string" ? contentBlock.name : "unknown";
      const input =
        typeof contentBlock.input === "string"
          ? contentBlock.input
          : JSON.stringify(contentBlock.input ?? "");
      const event: DebugEvent = { kind: "tool_use", tool, input };
      return { type: "debug", event };
    }
  }

  // Tool result (from subprocesses in verbose mode)
  if (type === "content_block_start" && debug) {
    const contentBlock = isRecord(parsed.content_block)
      ? parsed.content_block
      : undefined;
    if (contentBlock?.type === "tool_result") {
      const tool =
        typeof contentBlock.tool_use_id === "string"
          ? contentBlock.tool_use_id
          : "unknown";
      const output =
        typeof contentBlock.content === "string"
          ? contentBlock.content.slice(0, 500)
          : JSON.stringify(contentBlock.content ?? "").slice(0, 500);
      const event: DebugEvent = { kind: "tool_result", tool, output };
      return { type: "debug", event };
    }
  }

  // System messages
  if (type === "system" && debug) {
    const message =
      typeof parsed.message === "string"
        ? parsed.message
        : typeof parsed.error === "string"
          ? parsed.error
          : null;
    if (message) {
      const event: DebugEvent = { kind: "system", message };
      return { type: "debug", event };
    }
  }

  // Result message (final)
  if (type === "result" && typeof parsed.result === "string") {
    const { markdown, reasoning } = extractMarkdownFromOutput(parsed.result);
    if (markdown) {
      return { type: "done", markdown, reasoning };
    }
  }

  return null;
}

export function createStreamingTryRunner(
  systemPrompt: string,
): StreamingTryRunFn {
  return (
    prompt: string,
    config: ResolvedRunnerConfig,
    options: { debug: boolean; signal: AbortSignal },
  ): ReadableStream<TryStreamEvent> => {
    const args = buildStreamingCliArgs(
      config,
      prompt,
      systemPrompt,
      getClaudePath(),
    );
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
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        proc.kill();
      } catch {
        // ignore
      }
    }, timeoutMs);

    // Abort handling
    if (options.signal.aborted) {
      clearTimeout(timer);
      try {
        proc.kill();
      } catch {
        // ignore
      }
    } else {
      options.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          try {
            proc.kill();
          } catch {
            // ignore
          }
        },
        { once: true },
      );
    }

    let fullStdout = "";
    let buffer = "";

    return new ReadableStream<TryStreamEvent>({
      async pull(controller) {
        const reader = proc.stdout.getReader();

        try {
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            fullStdout += chunk;
            buffer += chunk;

            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const event = parseNdjsonLine(line, options.debug);
              if (event) {
                controller.enqueue(event);
              }
            }
          }

          // Process remaining buffer
          if (buffer.trim()) {
            const event = parseNdjsonLine(buffer, options.debug);
            if (event) {
              controller.enqueue(event);
            }
          }

          // Wait for process exit and handle final state
          const stderr = await new Response(proc.stderr).text();
          await proc.exited;

          clearTimeout(timer);

          if (timedOut) {
            controller.enqueue({
              type: "error",
              error: `Try timed out after ${config.timeout} seconds.`,
            });
          } else {
            // Check if we already sent a "done" event via the result NDJSON line
            const { markdown, reasoning } =
              extractMarkdownFromOutput(fullStdout);
            if (markdown) {
              controller.enqueue({ type: "done", markdown, reasoning });
            } else if (stderr.trim()) {
              const permissionError = detectPermissionError(stderr, config.cwd);
              controller.enqueue({
                type: "error",
                error: stderr.trim().slice(0, 500),
                ...(permissionError ? { permissionError } : {}),
              });
            } else {
              controller.enqueue({
                type: "error",
                error: "No output received from CLI.",
              });
            }
          }
        } catch (err: unknown) {
          clearTimeout(timer);
          const message =
            err instanceof Error ? err.message : "Streaming error";
          controller.enqueue({ type: "error", error: message });
        } finally {
          controller.close();
        }
      },
    });
  };
}

export function createMockStreamingTryRunner(
  handler: (
    prompt: string,
    config: ResolvedRunnerConfig,
    options: { debug: boolean; signal: AbortSignal },
  ) => TryStreamEvent[],
): StreamingTryRunFn {
  return (
    prompt: string,
    config: ResolvedRunnerConfig,
    options: { debug: boolean; signal: AbortSignal },
  ): ReadableStream<TryStreamEvent> => {
    const events = handler(prompt, config, options);
    return new ReadableStream<TryStreamEvent>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(event);
        }
        controller.close();
      },
    });
  };
}
