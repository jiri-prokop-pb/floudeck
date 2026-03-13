import { describe, expect, test } from "bun:test";
import { addInterval, isDue } from "./time.ts";

describe("addInterval", () => {
  const base = "2024-01-15T10:00:00.000Z";

  test("adds minutes", () => {
    expect(addInterval(base, 30, "minutes")).toBe("2024-01-15T10:30:00.000Z");
  });

  test("adds hours", () => {
    expect(addInterval(base, 2, "hours")).toBe("2024-01-15T12:00:00.000Z");
  });

  test("adds days", () => {
    expect(addInterval(base, 3, "days")).toBe("2024-01-18T10:00:00.000Z");
  });

  test("handles overflow (minutes wrapping hours)", () => {
    expect(addInterval(base, 90, "minutes")).toBe("2024-01-15T11:30:00.000Z");
  });
});

describe("isDue", () => {
  const now = "2024-01-15T10:00:00.000Z";

  test("returns true when next_run_at is in the past", () => {
    expect(isDue("2024-01-15T09:00:00.000Z", now)).toBe(true);
  });

  test("returns true when next_run_at equals now", () => {
    expect(isDue(now, now)).toBe(true);
  });

  test("returns false when next_run_at is in the future", () => {
    expect(isDue("2024-01-15T11:00:00.000Z", now)).toBe(false);
  });

  test("returns false when next_run_at is null", () => {
    expect(isDue(null, now)).toBe(false);
  });
});
