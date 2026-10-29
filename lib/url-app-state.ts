import type { CustomDateRange } from "./api";
import { coerceTimeRange, type TimeRange } from "./time-range";

export const APP_STATE_PARAM_PROJECT = "projectId";
export const APP_STATE_PARAM_RANGE = "range";
export const APP_STATE_PARAM_FROM = "from";
export const APP_STATE_PARAM_TO = "to";

const APP_STATE_KEYS = [
  APP_STATE_PARAM_PROJECT,
  APP_STATE_PARAM_RANGE,
  APP_STATE_PARAM_FROM,
  APP_STATE_PARAM_TO,
] as const;

export type AppUrlState = {
  projectId?: string;
  timeRange: TimeRange;
  customDateRange: CustomDateRange;
};

function parseIsoDate(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Reads project + time window from the current URL query string. */
export function parseAppUrlState(params: URLSearchParams): AppUrlState {
  const projectId = params.get(APP_STATE_PARAM_PROJECT)?.trim() || undefined;
  const rangeRaw = params.get(APP_STATE_PARAM_RANGE);
  const timeRange = coerceTimeRange(rangeRaw ?? undefined);

  if (timeRange === "custom") {
    const from = parseIsoDate(params.get(APP_STATE_PARAM_FROM));
    const to = parseIsoDate(params.get(APP_STATE_PARAM_TO));
    if (from && to && from.getTime() <= to.getTime()) {
      return { projectId, timeRange: "custom", customDateRange: { from, to } };
    }
    return { projectId, timeRange: "24h", customDateRange: {} };
  }

  return { projectId, timeRange, customDateRange: {} };
}

export function buildAppUrlStateQuery(state: {
  projectId?: string | null;
  timeRange: TimeRange;
  customDateRange: CustomDateRange;
}): URLSearchParams {
  const params = new URLSearchParams();
  if (state.projectId) {
    params.set(APP_STATE_PARAM_PROJECT, state.projectId);
  }
  params.set(APP_STATE_PARAM_RANGE, state.timeRange);
  if (
    state.timeRange === "custom" &&
    state.customDateRange.from instanceof Date &&
    state.customDateRange.to instanceof Date
  ) {
    params.set(APP_STATE_PARAM_FROM, state.customDateRange.from.toISOString());
    params.set(APP_STATE_PARAM_TO, state.customDateRange.to.toISOString());
  }
  return params;
}

/** Merges app state into existing query params (keeps unrelated keys). */
export function mergeAppUrlStateIntoSearchParams(
  current: URLSearchParams,
  state: {
    projectId?: string | null;
    timeRange: TimeRange;
    customDateRange: CustomDateRange;
  }
): string {
  const merged = new URLSearchParams(current);
  for (const key of APP_STATE_KEYS) {
    merged.delete(key);
  }
  const built = buildAppUrlStateQuery(state);
  built.forEach((value, key) => merged.set(key, value));
  return merged.toString();
}

export function appUrlStateMatchesContext(
  params: URLSearchParams,
  context: {
    projectId?: string | null;
    timeRange: TimeRange;
    customDateRange: CustomDateRange;
  }
): boolean {
  const parsed = parseAppUrlState(params);
  if ((parsed.projectId ?? null) !== (context.projectId ?? null)) return false;
  if (parsed.timeRange !== context.timeRange) return false;
  if (parsed.timeRange !== "custom") return true;
  const fromMs = context.customDateRange.from?.getTime();
  const toMs = context.customDateRange.to?.getTime();
  return (
    parsed.customDateRange.from?.getTime() === fromMs &&
    parsed.customDateRange.to?.getTime() === toMs
  );
}
