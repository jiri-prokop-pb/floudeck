import { describe, expect, test } from "bun:test";
import {
  SYSTEM_PROMPT,
  ALLOWED_TAGS,
  BEGIN_HTML,
  END_HTML,
  BEGIN_REASONING,
  END_REASONING,
} from "./prompts.ts";

describe("SYSTEM_PROMPT", () => {
  test("contains all delimiters", () => {
    expect(SYSTEM_PROMPT).toContain(BEGIN_HTML);
    expect(SYSTEM_PROMPT).toContain(END_HTML);
    expect(SYSTEM_PROMPT).toContain(BEGIN_REASONING);
    expect(SYSTEM_PROMPT).toContain(END_REASONING);
  });

  test("contains all allowed tags", () => {
    for (const tag of ALLOWED_TAGS) {
      expect(SYSTEM_PROMPT).toContain(tag);
    }
  });

  test("mentions key constraints", () => {
    expect(SYSTEM_PROMPT).toContain("Do not output JavaScript");
    expect(SYSTEM_PROMPT).toContain("script");
    expect(SYSTEM_PROMPT).toContain("iframe");
    expect(SYSTEM_PROMPT).toContain("form");
  });
});
