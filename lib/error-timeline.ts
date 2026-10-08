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

export const formatBucketLabel = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

export function bucketMsForWindow(fromMs: number, toMs: number): number {
  const spanHours = Math.max(1, (toMs - fromMs) / 3600_000);
  if (spanHours <= 3) return 5 * 60_000;
  if (spanHours <= 24) return 60 * 60_000;
  if (spanHours <= 24 * 4) return 6 * 60 * 60_000;
  return 24 * 60 * 60_000;
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
    const label = formatBucketLabel(sortKey);
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
