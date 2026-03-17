import { describe, expect, test } from "bun:test";
import { isBlockInputError, parseBlockInput } from "./validate.ts";

describe("parseBlockInput", () => {
  test("accepts valid input", () => {
    const result = parseBlockInput({
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(isBlockInputError(result)).toBe(false);
    if (!isBlockInputError(result)) {
      expect(result.prompt).toBe("test");
      expect(result.intervalValue).toBe(1);
      expect(result.intervalUnit).toBe("hours");
    }
  });

  test("trims prompt", () => {
    const result = parseBlockInput({
      prompt: "  hello  ",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(isBlockInputError(result)).toBe(false);
    if (!isBlockInputError(result)) {
      expect(result.prompt).toBe("hello");
    }
  });

  test("rejects empty prompt", () => {
    const result = parseBlockInput({
      prompt: "   ",
      intervalValue: 1,
      intervalUnit: "hours",
    });
    expect(isBlockInputError(result)).toBe(true);
    if (isBlockInputError(result)) {
      expect(result.message).toBe("Prompt is required");
    }
  });

  test("rejects invalid unit", () => {
    const result = parseBlockInput({
      prompt: "x",
      intervalValue: 1,
      intervalUnit: "weeks",
    });
    expect(isBlockInputError(result)).toBe(true);
    if (isBlockInputError(result)) {
      expect(result.message).toBe("Invalid interval unit");
    }
  });

  test("rejects interval <= 0", () => {
    const result = parseBlockInput({
      prompt: "x",
      intervalValue: 0,
      intervalUnit: "hours",
    });
    expect(isBlockInputError(result)).toBe(true);
    if (isBlockInputError(result)) {
      expect(result.message).toBe("Interval value must be a positive integer");
    }
  });

  test("rejects non-integer interval", () => {
    const result = parseBlockInput({
      prompt: "x",
      intervalValue: 1.5,
      intervalUnit: "hours",
    });
    expect(isBlockInputError(result)).toBe(true);
    if (isBlockInputError(result)) {
      expect(result.message).toBe("Interval value must be a positive integer");
    }
  });

  test("rejects non-object body", () => {
    const result = parseBlockInput(null);
    expect(isBlockInputError(result)).toBe(true);
  });
});
