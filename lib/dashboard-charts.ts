import type { LogEntry } from "@/lib/types";
import type { HeatmapCell, HorizontalBarPoint } from "@/lib/types";
import { bucketMsForWindow } from "@/lib/error-timeline";

const MAX_HEATMAP_COLUMNS = 48;

export type HeatmapBuildResult = {
  cells: HeatmapCell[];
  bucketMs: number;
  bucketCount: number;
  windowFromMs: number;
};

export function errorLabelFromLog(log: LogEntry): string {
  const fromStack = log.stackTrace?.split("\n").find((line) => line.trim().length > 0)?.trim();
  if (fromStack) {
    const withoutPrefix = fromStack.replace(/^[\w.$]+\s*:\s*/, "");
    return (withoutPrefix || fromStack).slice(0, 120);
  }
  const msg = log.message.trim();
  return msg.length > 120 ? `${msg.slice(0, 117)}…` : msg || "Unknown error";
}

export function buildTopEndpointsFromLogs(logs: LogEntry[], limit = 5): HorizontalBarPoint[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.level !== "ERROR") continue;
    const endpoint = log.endpoint?.trim() || extractRouteFromMessage(log.message);
    if (!endpoint) continue;
    counts.set(endpoint, (counts.get(endpoint) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function extractRouteFromMessage(message: string | undefined): string | undefined {
  if (!message) return undefined;
  const match = message.match(/(?:^|\s)route=([^\s]+)/);
  return match?.[1]?.trim() || undefined;
}

export function buildTopErrorsFromLogs(logs: LogEntry[], limit = 5): HorizontalBarPoint[] {
  const counts = new Map<string, number>();
  for (const log of logs) {
    if (log.level !== "ERROR") continue;
    const label = errorLabelFromLog(log);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

export function buildHeatmapFromErrorLogs(
  logs: LogEntry[],
  serviceNames: string[],
  fromMs: number,
  toMs: number
): HeatmapBuildResult {
  const baseBucketMs = bucketMsForWindow(fromMs, toMs);
  const windowFromMs = Math.floor(fromMs / baseBucketMs) * baseBucketMs;
  const windowToMs = Math.floor(toMs / baseBucketMs) * baseBucketMs;
  const spanMs = Math.max(baseBucketMs, windowToMs - windowFromMs + baseBucketMs);

  let bucketMs = baseBucketMs;
  let bucketCount = Math.max(1, Math.ceil(spanMs / bucketMs));
  if (bucketCount > MAX_HEATMAP_COLUMNS) {
    bucketCount = MAX_HEATMAP_COLUMNS;
    bucketMs = Math.max(baseBucketMs, Math.ceil(spanMs / bucketCount));
  }

  const errors = logs.filter((l) => l.level === "ERROR");
  const services =
    serviceNames.length > 0
      ? serviceNames
      : Array.from(new Set(errors.map((l) => l.service).filter(Boolean)));

  const counts = new Map<string, number>();
  for (const log of errors) {
    const ts = log.timestamp.getTime();
    if (ts < fromMs || ts > toMs) continue;
    const bucket = Math.min(
      bucketCount - 1,
      Math.max(0, Math.floor((ts - windowFromMs) / bucketMs))
    );
    const key = `${log.service}-${bucket}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: HeatmapCell[] = services.flatMap((service) =>
    Array.from({ length: bucketCount }, (_, hour) => ({
      service,
      hour,
      value: counts.get(`${service}-${hour}`) ?? 0,
    }))
  );

  return { cells, bucketMs, bucketCount, windowFromMs };
}

export function heatmapBucketIndexForLog(
  timestamp: Date,
  meta: HeatmapBuildResult
): number {
  const ts = timestamp.getTime();
  return Math.min(
    meta.bucketCount - 1,
    Math.max(0, Math.floor((ts - meta.windowFromMs) / meta.bucketMs))
  );
}
