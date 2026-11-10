import type { LogEntry, StackedAreaPoint, TimeSeriesPoint } from "@/lib/types";

type AggService = {
  service: string;
  totalErrors?: number;
  exceptions?: Array<{
    exception?: string;
    count?: number;
    timeline?: Array<{ timestamp: string; count: number }> | null;
  }>;
};

export const hourBucketKey = (date: Date): string => {
  const d = new Date(date);
  d.setUTCMinutes(0, 0, 0);
  return d.toISOString();
};

export const formatBucketLabel = (iso: string, bucketMs?: number): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  if (bucketMs !== undefined && bucketMs < 60_000) {
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const timelineBucketKey = (date: Date, bucketMs: number): string => {
  const start = Math.floor(date.getTime() / bucketMs) * bucketMs;
  return new Date(start).toISOString();
};

const bucketKeyFromTimestamp = (raw: string): string => {
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toISOString();
  }
  return raw;
};

const makePoint = (sortKey: string, label: string, serviceNames: string[]): TimeSeriesPoint => {
  const point: TimeSeriesPoint = { timestamp: label, _sortKey: sortKey };
  for (const service of serviceNames) {
    point[service] = 0;
  }
  return point;
};

export function buildErrorTimelineFromAggregations(
  services: AggService[] | null | undefined,
  serviceNames: string[]
): TimeSeriesPoint[] {
  const byBucket = new Map<string, TimeSeriesPoint>();

  for (const svc of services ?? []) {
    for (const ex of svc.exceptions ?? []) {
      for (const t of ex.timeline ?? []) {
        if (!t?.timestamp) continue;
        const sortKey = bucketKeyFromTimestamp(t.timestamp);
        const label = formatBucketLabel(sortKey);
        const existing = byBucket.get(sortKey) ?? makePoint(sortKey, label, serviceNames);
        const current = typeof existing[svc.service] === "number" ? (existing[svc.service] as number) : 0;
        existing[svc.service] = current + (t.count ?? 0);
        byBucket.set(sortKey, existing);
      }
    }
  }

  return Array.from(byBucket.values()).sort((a, b) =>
    String(a._sortKey ?? a.timestamp).localeCompare(String(b._sortKey ?? b.timestamp))
  );
}

/** Aligns with logspectra-backend LogQueryBuilder.errorHistogramInterval. */
export function bucketMsForWindow(fromMs: number, toMs: number): number {
  const spanSec = Math.max(1, (toMs - fromMs) / 1000);
  if (spanSec <= 3600) return 1000;
  if (spanSec <= 3 * 3600) return 10_000;
  if (spanSec <= 24 * 3600) return 60_000;
  if (spanSec <= 4 * 24 * 3600) return 15 * 60_000;
  return 3600_000;
}

/**
 * Fill missing buckets with zeros so Recharts draws a continuous time series (one point per bucket).
 */
export function densifyErrorTimeline(
  points: TimeSeriesPoint[],
  serviceNames: string[],
  fromMs: number,
  toMs: number,
  bucketMs: number
): TimeSeriesPoint[] {
  const keys =
    serviceNames.length > 0
      ? serviceNames
      : resolveTimelineServiceKeys(points, serviceNames);
  const byBucket = new Map<string, TimeSeriesPoint>();

  for (const point of points) {
    const rawKey = String(point._sortKey ?? point.timestamp);
    const parsed = new Date(rawKey).getTime();
    const sortKey = Number.isNaN(parsed)
      ? rawKey
      : new Date(Math.floor(parsed / bucketMs) * bucketMs).toISOString();
    const existing = byBucket.get(sortKey) ?? makePoint(sortKey, formatBucketLabel(sortKey, bucketMs), keys);
    for (const svc of keys) {
      const add = typeof point[svc] === "number" ? (point[svc] as number) : 0;
      const cur = typeof existing[svc] === "number" ? (existing[svc] as number) : 0;
      existing[svc] = cur + add;
    }
    byBucket.set(sortKey, existing);
  }

  const start = Math.floor(fromMs / bucketMs) * bucketMs;
  const end = Math.floor(toMs / bucketMs) * bucketMs;
  const maxPoints = 720;
  const step = end - start > maxPoints * bucketMs ? Math.ceil((end - start) / (maxPoints * bucketMs)) * bucketMs : bucketMs;

  const dense: TimeSeriesPoint[] = [];
  for (let t = start; t <= end; t += step) {
    const sortKey = new Date(t).toISOString();
    dense.push(byBucket.get(sortKey) ?? makePoint(sortKey, formatBucketLabel(sortKey, step), keys));
  }
  return dense;
}

export function buildErrorTimelineFromLogs(
  logs: LogEntry[],
  serviceNames: string[],
  fromMs: number,
  toMs: number
): TimeSeriesPoint[] {
  const errors = logs.filter((l) => l.level === "ERROR");
  if (errors.length === 0) return [];

  const bucketMs = bucketMsForWindow(fromMs, toMs);
  const byBucket = new Map<string, TimeSeriesPoint>();

  for (const log of errors) {
    const ts = log.timestamp.getTime();
    if (ts < fromMs || ts > toMs) continue;
    const bucketStart = Math.floor(ts / bucketMs) * bucketMs;
    const sortKey = new Date(bucketStart).toISOString();
    const label = formatBucketLabel(sortKey, bucketMs);
    const point = byBucket.get(sortKey) ?? makePoint(sortKey, label, serviceNames);
    const current = typeof point[log.service] === "number" ? (point[log.service] as number) : 0;
    point[log.service] = current + 1;
    byBucket.set(sortKey, point);
  }

  return Array.from(byBucket.values()).sort((a, b) =>
    String(a._sortKey ?? a.timestamp).localeCompare(String(b._sortKey ?? b.timestamp))
  );
}

export function buildErrorTimelineFromIngestion(ingestion: StackedAreaPoint[]): TimeSeriesPoint[] {
  if (!ingestion.length) return [];
  return ingestion.map((row) => ({
    timestamp: String(row.hour),
    errors: row.ERROR ?? 0,
  }));
}

/** Series keys to render on the stacked error chart. */
export function resolveTimelineServiceKeys(
  timeline: TimeSeriesPoint[],
  preferredServices: string[]
): string[] {
  const withData = new Set<string>();
  for (const point of timeline) {
    for (const key of Object.keys(point)) {
      if (key === "timestamp" || key === "_sortKey") continue;
      const value = point[key];
      if (typeof value === "number" && value > 0) {
        withData.add(key);
      }
    }
  }
  if (withData.size > 0) {
    const ordered = preferredServices.filter((s) => withData.has(s));
    const rest = Array.from(withData).filter((s) => !ordered.includes(s));
    return [...ordered, ...rest];
  }

  if (timeline.length > 0) {
    const keys = Object.keys(timeline[0]).filter((k) => k !== "timestamp" && k !== "_sortKey");
    if (keys.length > 0) return keys;
  }

  return preferredServices;
}
