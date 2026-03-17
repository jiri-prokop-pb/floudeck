import { describe, expect, test } from "bun:test";
import { createMockRunner, processCliOutput } from "./runner.ts";

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
