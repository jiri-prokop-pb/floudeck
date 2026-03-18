import { describe, expect, test } from "bun:test";
import { formatDate, formatTime } from "./format.ts";

describe("formatDate", () => {
  // March 18, 2026 is a Wednesday
  const date = new Date(2026, 2, 18);

  test("D. M.", () => {
    expect(formatDate(date, "D. M.")).toBe("Wed 18. 3.");
  });

  test("MM-DD", () => {
    expect(formatDate(date, "MM-DD")).toBe("Wed 03-18");
  });

  test("DD/MM", () => {
    expect(formatDate(date, "DD/MM")).toBe("Wed 18/03");
  });

  test("MM/DD", () => {
    expect(formatDate(date, "MM/DD")).toBe("Wed 03/18");
  });

  test("pads single-digit day and month", () => {
    const d = new Date(2026, 0, 5); // Jan 5, Mon
    expect(formatDate(d, "MM-DD")).toBe("Mon 01-05");
  });

  test("does not pad in D. M. format", () => {
    const d = new Date(2026, 0, 5); // Jan 5, Mon
    expect(formatDate(d, "D. M.")).toBe("Mon 5. 1.");
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
