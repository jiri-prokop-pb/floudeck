import { describe, expect, test } from "bun:test";
import {
  ACTION_BLOCK_SYSTEM_PROMPT,
  BEGIN_MARKDOWN,
  BEGIN_REASONING,
  composeActionBlockPrompt,
  END_MARKDOWN,
  END_REASONING,
  SYSTEM_PROMPT,
} from "./prompts.ts";

describe("SYSTEM_PROMPT", () => {
  test("contains all delimiters", () => {
    expect(SYSTEM_PROMPT).toContain(BEGIN_MARKDOWN);
    expect(SYSTEM_PROMPT).toContain(END_MARKDOWN);
    expect(SYSTEM_PROMPT).toContain(BEGIN_REASONING);
    expect(SYSTEM_PROMPT).toContain(END_REASONING);
  });

  test("requires H1 heading as first line", () => {
    expect(SYSTEM_PROMPT).toContain("# Title");
    expect(SYSTEM_PROMPT).toContain("level-1 heading");
  });

  test("mentions markdown features", () => {
    expect(SYSTEM_PROMPT).toContain("Bold");
    expect(SYSTEM_PROMPT).toContain("Tables");
    expect(SYSTEM_PROMPT).toContain("Code blocks");
    expect(SYSTEM_PROMPT).toContain("Links");
    expect(SYSTEM_PROMPT).toContain("MUST");
  });

  test("instructs no raw HTML", () => {
    expect(SYSTEM_PROMPT).toContain("Do NOT include raw HTML");
  });
});

describe("ACTION_BLOCK_SYSTEM_PROMPT", () => {
  test("contains delimiters", () => {
    expect(ACTION_BLOCK_SYSTEM_PROMPT).toContain(BEGIN_MARKDOWN);
    expect(ACTION_BLOCK_SYSTEM_PROMPT).toContain(END_MARKDOWN);
  });

  test("mentions user-triggered action", () => {
    expect(ACTION_BLOCK_SYSTEM_PROMPT).toContain("user-triggered action");
  });
});

describe("composeActionBlockPrompt", () => {
  test("replaces {{input}} with user input", () => {
    const result = composeActionBlockPrompt(
      "Deploy {{input}} to production",
      "my-app",
      "uuid-123",
    );
    expect(result).toContain("Deploy my-app to production");
    expect(result).toContain("[Block UUID: uuid-123]");
  });

  test("replaces multiple {{input}} occurrences", () => {
    const result = composeActionBlockPrompt(
      "Run {{input}} and check {{input}}",
      "service",
      "uuid-456",
    );
    expect(result).toBe(
      "Run service and check service\n\n[Block UUID: uuid-456]",
    );
  });

  test("handles empty input", () => {
    const result = composeActionBlockPrompt(
      "Template {{input}} here",
      "",
      "uuid-789",
    );
    expect(result).toContain("Template  here");
  });
});
