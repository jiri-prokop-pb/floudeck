import type { CreateBlockInput, IntervalUnit } from "./types.ts";

const VALID_UNITS = new Set<IntervalUnit>(["minutes", "hours", "days"]);

export type BlockInputError = {
  field: "prompt" | "intervalValue" | "intervalUnit";
  message: string;
};

export function parseBlockInput(
  body: unknown,
): CreateBlockInput | BlockInputError {
  if (!body || typeof body !== "object") {
    return { field: "prompt", message: "Request body must be a JSON object" };
  }

  const { prompt, intervalValue, intervalUnit } = body as Record<
    string,
    unknown
  >;

  if (typeof prompt !== "string" || !prompt.trim()) {
    return { field: "prompt", message: "Prompt is required" };
  }

  if (
    typeof intervalValue !== "number" ||
    !Number.isInteger(intervalValue) ||
    intervalValue <= 0
  ) {
    return {
      field: "intervalValue",
      message: "Interval value must be a positive integer",
    };
  }

  if (
    typeof intervalUnit !== "string" ||
    !VALID_UNITS.has(intervalUnit as IntervalUnit)
  ) {
    return { field: "intervalUnit", message: "Invalid interval unit" };
  }

  return {
    prompt: prompt.trim(),
    intervalValue,
    intervalUnit: intervalUnit as IntervalUnit,
  };
}

export function isBlockInputError(
  result: CreateBlockInput | BlockInputError,
): result is BlockInputError {
  return "field" in result;
}
