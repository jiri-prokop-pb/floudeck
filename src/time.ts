import type { IntervalUnit } from "./types.ts";

export function nowIso(): string {
  return new Date().toISOString();
}

export function addInterval(
  base: string,
  value: number,
  unit: IntervalUnit,
): string {
  const d = new Date(base);
  switch (unit) {
    case "minutes":
      d.setUTCMinutes(d.getUTCMinutes() + value);
      break;
    case "hours":
      d.setUTCHours(d.getUTCHours() + value);
      break;
    case "days":
      d.setUTCDate(d.getUTCDate() + value);
      break;
  }
  return d.toISOString();
}

export function isDue(nextRunAt: string | null, now?: string): boolean {
  if (!nextRunAt) return false;
  const nowMs = now ? new Date(now).getTime() : Date.now();
  return new Date(nextRunAt).getTime() <= nowMs;
}
