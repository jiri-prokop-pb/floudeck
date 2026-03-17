import { describe, expect, test } from "bun:test";
import { extractMarkdownFromOutput } from "./extract.ts";

describe("extractMarkdownFromOutput", () => {
  test("extracts markdown between delimiters", () => {
    const output = `some text
===BEGIN_MARKDOWN===
# Hello

Some content here
===END_MARKDOWN===
trailing`;
    const result = extractMarkdownFromOutput(output);
    expect(result.markdown).toBe("# Hello\n\nSome content here");
  });

  test("extracts reasoning", () => {
    const output = `===BEGIN_REASONING===
thinking here
===END_REASONING===
===BEGIN_MARKDOWN===
# Result

Done
===END_MARKDOWN===`;
    const result = extractMarkdownFromOutput(output);
    expect(result.reasoning).toBe("thinking here");
    expect(result.markdown).toBe("# Result\n\nDone");
  });

  test("returns null markdown when delimiters missing", () => {
    const result = extractMarkdownFromOutput("no delimiters here");
    expect(result.markdown).toBeNull();
  });

  test("returns null markdown when section is empty", () => {
    const output = `===BEGIN_MARKDOWN===
===END_MARKDOWN===`;
    const result = extractMarkdownFromOutput(output);
    expect(result.markdown).toBeNull();
  });

  test("returns null reasoning when not present", () => {
    const output = `===BEGIN_MARKDOWN===
# Test

Content
===END_MARKDOWN===`;
    const result = extractMarkdownFromOutput(output);
    expect(result.reasoning).toBeNull();
  });
});
