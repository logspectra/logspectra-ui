import { formatBucketLabel, timelineBucketKey } from "@/lib/error-timeline";
import { serviceColor } from "@/lib/service-colors";
import type {
  BarPoint,
  DashboardStats,
  HeatmapCell,
  HorizontalBarPoint,
  IssueGroup,
  LivePoint,
  LogEntry,
  PieSlice,
  TimeSeriesPoint,
  AreaPoint,
  ComposedPoint,
  SeverityMixPoint,
  DualLinePoint,
  StackedAreaPoint,
} from "@/lib/types";

export interface StatSparklines {
  totalLogs: number[];
  errorCount: number[];
  affectedServices: number[];
  aiAnalyses: number[];
}

const SPARKLINE_POINTS = 12;

/** Snapshot consumed by the home dashboard (and live incremental updates). */
export interface DashboardData {
  stats: DashboardStats;
  statSparklines: StatSparklines;
  logs: LogEntry[];
  issues: IssueGroup[];
  analysisSeedTraceId?: string;
  errorTimeline: TimeSeriesPoint[];
  distribution: PieSlice[];
  levelVolume: BarPoint[];
  topErrors: HorizontalBarPoint[];
  weeklyTrend: ComposedPoint[];
  resolutionDist: AreaPoint[];
  aiUsage: DualLinePoint[];
  ingestionRate: StackedAreaPoint[];
  severityMix: SeverityMixPoint[];
  topEndpoints: HorizontalBarPoint[];
  heatmap: HeatmapCell[];
  liveErrors: LivePoint[];
  /** Throttle rolling sparkline points during live ingest (ms). */
  lastSparklinePushAt?: number;
}

const SPARKLINE_THROTTLE_MS = 900;

const gentleRamp = (end: number, points = SPARKLINE_POINTS): number[] => {
  if (end <= 0) {
    return Array.from({ length: points }, () => 0);
  }
  if (points === 1) {
    return [end];
  }
  const start = Math.max(0, Math.round(end * 0.7));
  return Array.from({ length: points }, (_, index) => {
    const ratio = index / (points - 1);
    return Math.round(start + (end - start) * ratio);
  });
};

const pushSparkline = (series: number[], value: number): number[] => {
  const trimmed = series.length >= SPARKLINE_POINTS ? series.slice(-(SPARKLINE_POINTS - 1)) : series;
  return [...trimmed, value];
};

export function seedStatSparklines(stats: DashboardStats): StatSparklines {
  return {
    totalLogs: gentleRamp(stats.totalLogs),
    errorCount: gentleRamp(stats.errorCount),
    affectedServices: gentleRamp(stats.affectedServices.count),
    aiAnalyses: gentleRamp(stats.aiAnalysesRun),
  };
}

export function ensureDashboardSparklines(data: DashboardData): DashboardData {
  if (data.statSparklines) {
    return data;
  }
  return { ...data, statSparklines: seedStatSparklines(data.stats) };
}

const refreshSparklineSeries = (
  series: number[],
  value: number,
  rollWindow: boolean
): number[] => {
  if (series.length === 0) {
    return gentleRamp(value);
  }
  if (!rollWindow) {
    const next = [...series];
    next[next.length - 1] = value;
    return next;
  }
  return pushSparkline(series, value);
};

const withUpdatedSparklines = (
  data: DashboardData,
  stats: DashboardStats
): Pick<DashboardData, "statSparklines" | "lastSparklinePushAt"> => {
  const current = data.statSparklines ?? seedStatSparklines(data.stats);
  const now = Date.now();
  const lastPush = data.lastSparklinePushAt ?? 0;
  const rollWindow = now - lastPush >= SPARKLINE_THROTTLE_MS;

  const statSparklines: StatSparklines = {
    totalLogs: refreshSparklineSeries(current.totalLogs, stats.totalLogs, rollWindow),
    errorCount: refreshSparklineSeries(current.errorCount, stats.errorCount, rollWindow),
    affectedServices: refreshSparklineSeries(
      current.affectedServices,
      stats.affectedServices.count,
      rollWindow
    ),
    aiAnalyses: refreshSparklineSeries(current.aiAnalyses, stats.aiAnalysesRun, rollWindow),
  };

  return {
    statSparklines,
    lastSparklinePushAt: rollWindow ? now : lastPush,
  };
};

const hourUtc = (date: Date): number => date.getUTCHours();

const bumpLevelVolume = (rows: BarPoint[], level: LogEntry["level"]): BarPoint[] => {
  const found = rows.some((row) => row.name === level);
  if (!found) {
    return [...rows, { name: level, value: 1 }];
  }
  return rows.map((row) => (row.name === level ? { ...row, value: row.value + 1 } : row));
};

const bumpDistribution = (slices: PieSlice[], service: string): PieSlice[] => {
  const existing = slices.find((slice) => slice.name === service);
  if (existing) {
    return slices.map((slice) =>
      slice.name === service ? { ...slice, value: slice.value + 1 } : slice
    );
  }
  return [...slices, { name: service, value: 1, color: serviceColor(service) }];
};

const bumpTopErrors = (rows: HorizontalBarPoint[], label: string): HorizontalBarPoint[] => {
  const trimmed = label.trim() || "Unknown";
  const existing = rows.find((row) => row.name === trimmed);
  let next: HorizontalBarPoint[];
  if (existing) {
    next = rows.map((row) => (row.name === trimmed ? { ...row, value: row.value + 1 } : row));
  } else {
    next = [...rows, { name: trimmed, value: 1 }];
  }
  return next.sort((a, b) => b.value - a.value).slice(0, 5);
};

const bumpErrorTimeline = (
  timeline: TimeSeriesPoint[],
  service: string,
  services: string[],
  bucketIso: string
): TimeSeriesPoint[] => {
  const index = timeline.findIndex(
    (point) => point._sortKey === bucketIso || point.timestamp === bucketIso
  );
  if (index >= 0) {
    const point = { ...timeline[index] };
    const current = typeof point[service] === "number" ? (point[service] as number) : 0;
    point[service] = current + 1;
    const updated = [...timeline];
    updated[index] = point;
    return updated;
  }

  const point: TimeSeriesPoint = {
    timestamp: formatBucketLabel(bucketIso, 1000),
    _sortKey: bucketIso,
  };
  for (const svc of services) {
    point[svc] = svc === service ? 1 : 0;
  }
  if (!services.includes(service)) {
    point[service] = 1;
  }
  return [...timeline, point].sort((a, b) =>
    String(a._sortKey ?? a.timestamp).localeCompare(String(b._sortKey ?? b.timestamp))
  );
};

const bumpHeatmap = (cells: HeatmapCell[], service: string, hour: number): HeatmapCell[] => {
  const index = cells.findIndex((cell) => cell.service === service && cell.hour === hour);
  if (index >= 0) {
    return cells.map((cell, i) =>
      i === index ? { ...cell, value: cell.value + 1 } : cell
    );
  }
  return [...cells, { service, hour, value: 1 }];
};

const ensureService = (stats: DashboardStats, service: string): DashboardStats => {
  if (stats.totalServices.includes(service)) {
    return stats;
  }
  const totalServices = [...stats.totalServices, service];
  return {
    ...stats,
    totalServices,
    serviceCount: totalServices.length,
  };
};

const bumpAffectedServices = (stats: DashboardStats, service: string): DashboardStats => {
  const affected = stats.affectedServices.services.includes(service)
    ? stats.affectedServices.services
    : [...stats.affectedServices.services, service];
  return {
    ...stats,
    affectedServices: {
      count: affected.length,
      services: affected,
    },
  };
};

/**
 * Immutable reducer: apply one live log event onto dashboard chart state.
 */
export function applyLiveLogToDashboard(data: DashboardData, log: LogEntry): DashboardData {
  let stats = ensureService(
    { ...data.stats, totalLogs: data.stats.totalLogs + 1 },
    log.service
  );

  const levelVolume = bumpLevelVolume(data.levelVolume, log.level);
  const logs = [log, ...data.logs].slice(0, 200);

  if (log.level !== "ERROR") {
    const spark = withUpdatedSparklines(data, stats);
    return {
      ...data,
      stats,
      levelVolume,
      logs,
      ...spark,
    };
  }

  stats = {
    ...bumpAffectedServices(stats, log.service),
    errorCount: stats.errorCount + 1,
  };

  const key = timelineBucketKey(log.timestamp, 1000);
  const hour = hourUtc(log.timestamp);
  const errorLabel = log.stackTrace?.split("\n")[0]?.trim() || log.message.slice(0, 80);

  const spark = withUpdatedSparklines(data, stats);

  return {
    ...data,
    stats,
    logs,
    levelVolume,
    ...spark,
    distribution: bumpDistribution(data.distribution, log.service),
    topErrors: bumpTopErrors(data.topErrors, errorLabel),
    errorTimeline: bumpErrorTimeline(data.errorTimeline, log.service, stats.totalServices, key),
    heatmap: bumpHeatmap(data.heatmap, log.service, hour),
  };
}

const emptyStats = (): DashboardStats => ({
  totalLogs: 0,
  totalLogsChangePercent: 0,
  errorCount: 0,
  errorChangePercent: 0,
  affectedServices: { count: 0, services: [] },
  aiAnalysesRun: 0,
  aiCached: 0,
  aiSaved: 0,
  totalServices: [],
  serviceCount: 0,
});

/** Placeholder while custom range is incomplete or before first fetch. */
export function createEmptyDashboardData(): DashboardData {
  const stats = emptyStats();
  return {
    stats,
    statSparklines: seedStatSparklines(stats),
    logs: [],
    issues: [],
    errorTimeline: [],
    distribution: [],
    levelVolume: [],
    topErrors: [],
    weeklyTrend: [],
    resolutionDist: [],
    aiUsage: [],
    ingestionRate: [],
    severityMix: [],
    topEndpoints: [],
    heatmap: [],
    liveErrors: Array.from({ length: 60 }, (_, i) => ({ timestamp: i, errors: 0, throughput: 0 })),
  };
}
