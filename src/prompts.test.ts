import { describe, expect, test } from "bun:test";
import {
  BEGIN_MARKDOWN,
  BEGIN_REASONING,
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
