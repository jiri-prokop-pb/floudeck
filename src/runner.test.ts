import { describe, expect, test } from "bun:test";
import {
  createMockRunner,
  detectPermissionError,
  parseNdjsonLine,
  processCliOutput,
} from "./runner.ts";

describe("processCliOutput", () => {
  test("valid output extracts markdown", () => {
    const stdout = `===BEGIN_REASONING===
Thinking about it
===END_REASONING===
===BEGIN_MARKDOWN===
# Hello

Some **bold** content
===END_MARKDOWN===`;
    const result = processCliOutput(stdout, "", 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.markdown).toContain("# Hello");
      expect(result.markdown).toContain("**bold**");
      expect(result.reasoning).toBe("Thinking about it");
    }
  });

  test("missing delimiters returns error", () => {
    const result = processCliOutput("just some text without delimiters", "", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Task returned no markdown output.");
    }
  });

  test("empty markdown section returns error", () => {
    const stdout = `===BEGIN_MARKDOWN===
===END_MARKDOWN===`;
    const result = processCliOutput(stdout, "", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Task returned no markdown output.");
    }
  });

  test("non-zero exit code returns error with stderr", () => {
    const result = processCliOutput("", "something went wrong", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("CLI exited with code 1");
      expect(result.error).toContain("something went wrong");
    }
  });

  test("non-zero exit code without stderr", () => {
    const result = processCliOutput("", "", 1);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("CLI exited with code 1");
    }
  });
});

describe("createMockRunner", () => {
  test("returns predictable success result", async () => {
    const runner = createMockRunner(() => ({
      ok: true,
      markdown: "# Mock\n\nDone",
      reasoning: null,
    }));
    const result = await runner("test prompt");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.markdown).toBe("# Mock\n\nDone");
    }
  });

  test("returns predictable error result", async () => {
    const runner = createMockRunner(() => ({
      ok: false,
      error: "mock error",
    }));
    const result = await runner("test prompt");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("mock error");
    }
  });

  test("receives the prompt", async () => {
    let receivedPrompt = "";
    const runner = createMockRunner((prompt) => {
      receivedPrompt = prompt;
      return {
        ok: true,
        markdown: "# X\n\nDone",
        reasoning: null,
      };
    });
    await runner("my prompt");
    expect(receivedPrompt).toBe("my prompt");
  });
});

describe("parseNdjsonLine", () => {
  // Helper: wrap an API event in the CLI's stream_event envelope
  function streamEvent(event: Record<string, unknown>): string {
    return JSON.stringify({ type: "stream_event", event });
  }

  test("parses text_delta from stream_event envelope", () => {
    const line = streamEvent({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "Hello" },
    });
    const result = parseNdjsonLine(line, false);
    expect(result).toEqual({ type: "text", text: "Hello" });
  });

  test("parses thinking_delta only in debug mode", () => {
    const line = streamEvent({
      type: "content_block_delta",
      delta: { type: "thinking_delta", thinking: "Let me think..." },
    });
    expect(parseNdjsonLine(line, false)).toBeNull();
    const result = parseNdjsonLine(line, true);
    expect(result).toEqual({
      type: "debug",
      event: { kind: "thinking", text: "Let me think..." },
    });
  });

  test("parses tool_use only in debug mode", () => {
    const line = streamEvent({
      type: "content_block_start",
      content_block: { type: "tool_use", name: "Read", input: "file.ts" },
    });
    expect(parseNdjsonLine(line, false)).toBeNull();
    const result = parseNdjsonLine(line, true);
    expect(result).toEqual({
      type: "debug",
      event: { kind: "tool_use", tool: "Read", input: "file.ts" },
    });
  });

  test("parses top-level result message as done event", () => {
    const line = JSON.stringify({
      type: "result",
      result:
        "===BEGIN_REASONING===\nThinking\n===END_REASONING===\n===BEGIN_MARKDOWN===\n# Title\n\nContent\n===END_MARKDOWN===",
    });
    const result = parseNdjsonLine(line, false);
    expect(result).toEqual({
      type: "done",
      markdown: "# Title\n\nContent",
      reasoning: "Thinking",
    });
  });

  test("skips system init message", () => {
    const line = JSON.stringify({
      type: "system",
      subtype: "init",
      tools: [],
    });
    expect(parseNdjsonLine(line, true)).toBeNull();
  });

  test("returns null for empty lines", () => {
    expect(parseNdjsonLine("", false)).toBeNull();
    expect(parseNdjsonLine("  ", false)).toBeNull();
  });

  test("returns null for invalid JSON", () => {
    expect(parseNdjsonLine("not json", false)).toBeNull();
  });

  test("returns null for unknown event types", () => {
    const line = JSON.stringify({ type: "ping" });
    expect(parseNdjsonLine(line, false)).toBeNull();
  });
});

describe("detectPermissionError", () => {
  test("detects 'permission denied'", () => {
    const result = detectPermissionError("Error: permission denied", "/tmp");
    expect(result).toBeDefined();
    if (result) {
      expect(result.cwd).toBe("/tmp");
      expect(result.instructions).toContain("settings.local.json");
    }
  });

  test("detects EPERM", () => {
    const result = detectPermissionError(
      "EPERM: operation not permitted",
      "/tmp",
    );
    expect(result).toBeDefined();
  });

  test("returns undefined for non-permission errors", () => {
    const result = detectPermissionError("syntax error", "/tmp");
    expect(result).toBeUndefined();
  });
});
