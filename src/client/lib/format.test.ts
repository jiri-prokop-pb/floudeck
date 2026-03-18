import { describe, expect, test } from "bun:test";
import { formatDate, formatTime } from "./format.ts";

describe("formatDate", () => {
  const date = new Date(2026, 2, 18); // March 18, 2026

  test("D. M. YYYY", () => {
    expect(formatDate(date, "D. M. YYYY")).toBe("18. 3. 2026");
  });

  test("YYYY-MM-DD", () => {
    expect(formatDate(date, "YYYY-MM-DD")).toBe("2026-03-18");
  });

  test("DD/MM/YYYY", () => {
    expect(formatDate(date, "DD/MM/YYYY")).toBe("18/03/2026");
  });

  test("MM/DD/YYYY", () => {
    expect(formatDate(date, "MM/DD/YYYY")).toBe("03/18/2026");
  });

  test("pads single-digit day and month in ISO format", () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(formatDate(d, "YYYY-MM-DD")).toBe("2026-01-05");
  });

  test("does not pad in D. M. YYYY format", () => {
    const d = new Date(2026, 0, 5); // Jan 5
    expect(formatDate(d, "D. M. YYYY")).toBe("5. 1. 2026");
  });
});

describe("formatTime", () => {
  test("24h format — morning", () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(formatTime(d, "24h")).toBe("09:05");
  });

  test("24h format — afternoon", () => {
    const d = new Date(2026, 0, 1, 14, 30);
    expect(formatTime(d, "24h")).toBe("14:30");
  });

  test("24h format — midnight", () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatTime(d, "24h")).toBe("00:00");
  });

  test("12h format — morning", () => {
    const d = new Date(2026, 0, 1, 9, 5);
    expect(formatTime(d, "12h")).toBe("9:05 AM");
  });

  test("12h format — afternoon", () => {
    const d = new Date(2026, 0, 1, 14, 30);
    expect(formatTime(d, "12h")).toBe("2:30 PM");
  });

  test("12h format — midnight", () => {
    const d = new Date(2026, 0, 1, 0, 0);
    expect(formatTime(d, "12h")).toBe("12:00 AM");
  });

  test("12h format — noon", () => {
    const d = new Date(2026, 0, 1, 12, 0);
    expect(formatTime(d, "12h")).toBe("12:00 PM");
  });
});
