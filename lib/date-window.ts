export type CustomDateRangeInput = {
  from?: Date;
  to?: Date;
};

export type ResolvedDateWindow = {
  from: string;
  to: string;
  fromMs: number;
  toMs: number;
};

const timeRangeToHours = (timeRange: string | number): number => {
  if (typeof timeRange === "number") return timeRange;

  switch (timeRange) {
    case "1h":
      return 1;
    case "6h":
      return 6;
    case "24h":
      return 24;
    case "7d":
      return 24 * 7;
    case "30d":
      return 24 * 30;
    default:
      return 24;
  }
};

const isoHoursAgo = (hours: number): string => new Date(Date.now() - hours * 3600_000).toISOString();
const nowIso = (): string => new Date().toISOString();

/**
 * Resolves the active query window. Returns null when "custom" is selected but both dates are not set.
 */
export function resolveDateWindow(
  timeRange: string | number,
  customDateRange?: CustomDateRangeInput
): ResolvedDateWindow | null {
  if (timeRange === "custom") {
    if (!(customDateRange?.from instanceof Date) || !(customDateRange?.to instanceof Date)) {
      return null;
    }
    const from = new Date(customDateRange.from);
    const to = new Date(customDateRange.to);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    if (from.getTime() > to.getTime()) {
      return null;
    }
    return {
      from: from.toISOString(),
      to: to.toISOString(),
      fromMs: from.getTime(),
      toMs: to.getTime(),
    };
  }

  const hours = timeRangeToHours(timeRange);
  const toMs = Date.now();
  const fromMs = toMs - hours * 3600_000;
  return {
    from: new Date(fromMs).toISOString(),
    to: new Date(toMs).toISOString(),
    fromMs,
    toMs,
  };
}

export function isWithinDateWindow(timestamp: Date, window: ResolvedDateWindow): boolean {
  const ms = timestamp.getTime();
  return ms >= window.fromMs && ms <= window.toMs;
}
