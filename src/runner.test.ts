import { describe, expect, test } from "bun:test";
import { processCliOutput, createMockRunner } from "./runner.ts";

describe("processCliOutput", () => {
  test("valid output extracts and sanitizes HTML", () => {
    const stdout = `===BEGIN_REASONING===
Thinking about it
===END_REASONING===
===BEGIN_HTML===
<div class="test"><p>Hello <strong>world</strong></p></div>
===END_HTML===`;
    const result = processCliOutput(stdout, "", 0);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toContain("<p>Hello <strong>world</strong></p>");
      expect(result.reasoning).toBe("Thinking about it");
    }
  });

  test("missing delimiters returns error", () => {
    const result = processCliOutput("just some text without delimiters", "", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Task returned no HTML output.");
    }
  });

  test("empty HTML section returns error", () => {
    const stdout = `===BEGIN_HTML===
===END_HTML===`;
    const result = processCliOutput(stdout, "", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Task returned no HTML output.");
    }
  });

  test("all-unsafe HTML sanitized to empty returns error", () => {
    const stdout = `===BEGIN_HTML===
<script>alert(1)</script>
===END_HTML===`;
    const result = processCliOutput(stdout, "", 0);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Task returned invalid or unsafe HTML.");
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
      html: "<p>mock</p>",
      rawHtml: "<p>mock</p>",
      reasoning: null,
    }));
    const result = await runner("test prompt");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.html).toBe("<p>mock</p>");
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
      return { ok: true, html: "<p>x</p>", rawHtml: "<p>x</p>", reasoning: null };
    });
    await runner("my prompt");
    expect(receivedPrompt).toBe("my prompt");
  });
});
