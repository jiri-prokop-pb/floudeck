import { describe, expect, test } from "bun:test";
import {
  isBlockInputError,
  parseBlockInput,
  parseRunnerConfig,
} from "./validate.ts";

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

  test("accepts valid input with runnerConfig", () => {
    const result = parseBlockInput({
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
      runnerConfig: { model: "opus", timeout: 120 },
    });
    expect(isBlockInputError(result)).toBe(false);
    if (!isBlockInputError(result)) {
      expect(result.runnerConfig).toEqual({ model: "opus", timeout: 120 });
    }
  });

  test("ignores invalid runnerConfig gracefully", () => {
    const result = parseBlockInput({
      prompt: "test",
      intervalValue: 1,
      intervalUnit: "hours",
      runnerConfig: "not an object",
    });
    expect(isBlockInputError(result)).toBe(false);
    if (!isBlockInputError(result)) {
      expect(result.runnerConfig).toBeUndefined();
    }
  });
});

describe("parseRunnerConfig", () => {
  test("returns null for non-object", () => {
    expect(parseRunnerConfig(null)).toBeNull();
    expect(parseRunnerConfig("string")).toBeNull();
    expect(parseRunnerConfig(42)).toBeNull();
    expect(parseRunnerConfig([])).toBeNull();
  });

  test("returns null for empty object", () => {
    expect(parseRunnerConfig({})).toBeNull();
  });

  test("picks known keys", () => {
    const result = parseRunnerConfig({
      model: "opus",
      cwd: "/my/path",
      permissions: "sandbox",
      timeout: 120,
    });
    expect(result).toEqual({
      model: "opus",
      cwd: "/my/path",
      permissions: "sandbox",
      timeout: 120,
    });
  });

  test("ignores unknown keys", () => {
    const result = parseRunnerConfig({
      model: "opus",
      unknownKey: "value",
      anotherOne: 42,
    });
    expect(result).toEqual({ model: "opus" });
  });

  test("validates permissions enum", () => {
    expect(parseRunnerConfig({ permissions: "invalid" })).toBeNull();
    expect(parseRunnerConfig({ permissions: "sandbox" })).toEqual({
      permissions: "sandbox",
    });
    expect(
      parseRunnerConfig({ permissions: "dangerouslySkipPermissions" }),
    ).toEqual({ permissions: "dangerouslySkipPermissions" });
  });

  test("rejects non-positive timeout", () => {
    expect(parseRunnerConfig({ timeout: 0 })).toBeNull();
    expect(parseRunnerConfig({ timeout: -5 })).toBeNull();
  });

  test("parses env as Record<string, string>", () => {
    const result = parseRunnerConfig({
      env: { KEY: "value", NUM: "123" },
    });
    expect(result).toEqual({ env: { KEY: "value", NUM: "123" } });
  });

  test("filters non-string env values", () => {
    const result = parseRunnerConfig({
      env: { GOOD: "val", BAD: 42 },
    });
    expect(result).toEqual({ env: { GOOD: "val" } });
  });

  test("trims string values", () => {
    const result = parseRunnerConfig({
      cwd: "  /path  ",
      model: " sonnet ",
    });
    expect(result).toEqual({ cwd: "/path", model: "sonnet" });
  });

  test("allowCwd: false strips cwd from result", () => {
    const result = parseRunnerConfig(
      { cwd: "/my/path", model: "opus" },
      { allowCwd: false },
    );
    expect(result).toEqual({ model: "opus" });
  });

  test("allowCwd: false returns null if only cwd was present", () => {
    const result = parseRunnerConfig(
      { cwd: "/my/path" },
      { allowCwd: false },
    );
    expect(result).toBeNull();
  });

  test("allowCwd defaults to true", () => {
    const result = parseRunnerConfig({ cwd: "/my/path" });
    expect(result).toEqual({ cwd: "/my/path" });
  });
});
