import { timeRangeToHours } from "./time-range";

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
    to: nowIso(),
    fromMs,
    toMs,
  };
}

export function isWithinDateWindow(timestamp: Date, window: ResolvedDateWindow): boolean {
  const ms = timestamp.getTime();
  return ms >= window.fromMs && ms <= window.toMs;
}

/**
 * Rolling preset ranges (1h, 24h, …) freeze `window.toMs` at resolve time; live SSE logs need a sliding upper bound.
 */
export function isWithinLiveDateWindow(
  timestamp: Date,
  timeRange: string | number,
  window: ResolvedDateWindow
): boolean {
  const ms = timestamp.getTime();
  if (timeRange === "custom") {
    return isWithinDateWindow(timestamp, window);
  }
  const hours = timeRangeToHours(timeRange);
  const now = Date.now();
  const fromMs = now - hours * 3600_000;
  return ms >= fromMs && ms <= now;
}
