import type { CustomDateRangeInput } from "./date-window";

/** Preset keys sent to APIs; `custom` uses calendar range from project context. */
export type TimeRange =
  | "1h"
  | "3h"
  | "6h"
  | "12h"
  | "24h"
  | "2d"
  | "4d"
  | "7d"
  | "custom";

export const TIME_RANGE_OPTIONS: ReadonlyArray<{ value: TimeRange; label: string }> = [
  { value: "1h", label: "1 hour" },
  { value: "3h", label: "3 hours" },
  { value: "6h", label: "6 hours" },
  { value: "12h", label: "12 hours" },
  { value: "24h", label: "24 hours" },
  { value: "2d", label: "2 days" },
  { value: "4d", label: "4 days" },
  { value: "7d", label: "7 days" },
  { value: "custom", label: "Custom date range" },
];

const PRESET_HOURS: Record<Exclude<TimeRange, "custom">, number> = {
  "1h": 1,
  "3h": 3,
  "6h": 6,
  "12h": 12,
  "24h": 24,
  "2d": 48,
  "4d": 96,
  "7d": 168,
};

/** Maps legacy UI values to the current preset set. */
export function coerceTimeRange(value: string | undefined, fallback: TimeRange = "24h"): TimeRange {
  if (value === "custom") return "custom";
  if (value && value in PRESET_HOURS) return value as Exclude<TimeRange, "custom">;
  switch (value) {
    case "30d":
      return "7d";
    default:
      return fallback;
  }
}

export function timeRangeToHours(timeRange: string | number): number {
  if (typeof timeRange === "number") return timeRange;
  if (timeRange === "custom") return 24;
  const coerced = coerceTimeRange(timeRange);
  if (coerced === "custom") return 24;
  return PRESET_HOURS[coerced];
}

const durationHoursForCustomRange = (customDateRange?: CustomDateRangeInput): number | null => {
  if (!(customDateRange?.from instanceof Date) || !(customDateRange?.to instanceof Date)) return null;

  const from = new Date(customDateRange.from);
  const to = new Date(customDateRange.to);

  const diffMs = Math.max(0, to.getTime() - from.getTime());
  return Math.max(1, Math.ceil(diffMs / 3600_000));
};

/** Issue API `window` query param (backend accepts e.g. 3h, 12h, 2d). */
export function normalizeIssueWindow(
  timeRange: string,
  customDateRange?: CustomDateRangeInput
): string | null {
  if (timeRange === "custom") {
    const customHours = durationHoursForCustomRange(customDateRange);
    if (customHours === null) return null;
    if (customHours % 24 === 0 && customHours >= 24) {
      return `${customHours / 24}d`;
    }
    return `${customHours}h`;
  }

  const coerced = coerceTimeRange(timeRange);
  if (coerced === "custom") return null;
  return coerced;
}
