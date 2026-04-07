"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import { api, tokenStore } from "@/lib/api";
import type { LivePoint, LogEntry } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Copy, Check } from "lucide-react";

type StreamPayload =
  | LogEntry
  | {
      log?: LogEntry;
      point?: Partial<LivePoint>;
      timestamp?: string | number;
      errors?: number;
      throughput?: number;
      level?: LogEntry["level"];
      service?: string;
      traceId?: string;
      message?: string;
      id?: string;
    };

type StreamLogDocument = {
  id?: string;
  projectId?: string;
  timestamp?: string | number;
  level?: string;
  service?: string;
  traceId?: string;
  spanId?: string;
  thread?: string;
  logger?: string;
  message?: string;
  endpoint?: string;
  exception?: string;
  stackTrace?: string;
  host?: string;
  environment?: string;
};

const SUPPORTED_LEVELS: Array<LogEntry["level"]> = ["DEBUG", "INFO", "WARN", "ERROR"];

const normalizeLevel = (value?: string): LogEntry["level"] => {
  if (!value) return "INFO";
  const upper = value.toUpperCase();
  return SUPPORTED_LEVELS.includes(upper as LogEntry["level"])
    ? (upper as LogEntry["level"])
    : "INFO";
};

const isLogLike = (value: unknown): value is Partial<LogEntry> => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<LogEntry>;
  return !!candidate.message && !!candidate.service && !!candidate.level;
};

const toLogEntry = (value: Partial<LogEntry>): LogEntry => ({
  id: value.id || `${Date.now()}-${Math.random()}`,
  timestamp: value.timestamp instanceof Date ? value.timestamp : new Date(value.timestamp || Date.now()),
  level: normalizeLevel(value.level),
  service: value.service || "unknown-service",
  traceId: value.traceId || "",
  message: value.message || "",
  stackTrace: value.stackTrace,
});

const toLogEntryFromDocument = (value: StreamLogDocument): LogEntry => ({
  id: value.id || `${Date.now()}-${Math.random()}`,
  timestamp: new Date(value.timestamp || Date.now()),
  level: normalizeLevel(value.level),
  service: value.service || "unknown-service",
  traceId: value.traceId || "",
  message: value.endpoint ? `${value.message || ""} (${value.endpoint})` : (value.message || ""),
  stackTrace: value.stackTrace || value.exception,
});

const toLivePoint = (
  value: { timestamp?: string | number; errors?: number; throughput?: number },
  fallbackTimestamp: number
): LivePoint => ({
  timestamp: (() => {
    if (typeof value.timestamp === "number") {
      // Normalize epoch millis to epoch seconds for chart bucketing.
      return value.timestamp > 1_000_000_000_000 ? Math.floor(value.timestamp / 1000) : value.timestamp;
    }
    if (typeof value.timestamp === "string") {
      const parsed = Date.parse(value.timestamp);
      return Number.isNaN(parsed) ? fallbackTimestamp : Math.floor(parsed / 1000);
    }
    return fallbackTimestamp;
  })(),
  errors: value.errors ?? 0,
  throughput: value.throughput ?? 0,
});

const formatTimeTick = (timestamp: number | string) => {
  const numeric = typeof timestamp === "number" ? timestamp : Number(timestamp);
  if (Number.isNaN(numeric)) return "--:--:--";
  return new Date(numeric * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
};

const resolveLiveBootstrapWindow = (
  timeRange: "1h" | "6h" | "24h" | "7d" | "30d" | "custom",
  customDateRange: { from?: Date; to?: Date }
): { from: string; to: string } => {
  if (
    timeRange === "custom" &&
    customDateRange?.from instanceof Date &&
    customDateRange?.to instanceof Date
  ) {
    const from = new Date(customDateRange.from);
    const to = new Date(customDateRange.to);
    from.setHours(0, 0, 0, 0);
    to.setHours(23, 59, 59, 999);
    return { from: from.toISOString(), to: to.toISOString() };
  }

  const hours =
    timeRange === "1h" ? 1 :
    timeRange === "6h" ? 6 :
    timeRange === "24h" ? 24 :
    timeRange === "7d" ? 24 * 7 :
    timeRange === "30d" ? 24 * 30 :
    24;

  return {
    from: new Date(Date.now() - hours * 3600_000).toISOString(),
    to: new Date().toISOString(),
  };
};

export default function LiveStream() {
  const { selectedProject, timeRange, customDateRange } = useProject();
  const [liveData, setLiveData] = useState<LivePoint[]>([]);
  const [liveLogEntries, setLiveLogEntries] = useState<LogEntry[]>([]);
  const [copiedTraceId, setCopiedTraceId] = useState<string | null>(null);

  const buildMetricsFromLogs = (logs: LogEntry[]): LivePoint[] => {
    const buckets = new Map<number, { errors: number; throughput: number }>();

    for (const log of logs) {
      const seconds = Math.floor(log.timestamp.getTime() / 1000);
      const existing = buckets.get(seconds) || { errors: 0, throughput: 0 };
      existing.throughput += 1;
      if (log.level === "ERROR") {
        existing.errors += 1;
      }
      buckets.set(seconds, existing);
    }

    return Array.from(buckets.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, value]) => ({
        timestamp,
        errors: value.errors,
        throughput: value.throughput,
      }))
      .slice(-60);
  };

  // Connect to SSE live stream endpoint and reconnect on disconnect.
  useEffect(() => {
    let isMounted = true;
    let abortController: AbortController | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const appendLivePoint = (nextPoint: { timestamp?: string | number; errors?: number; throughput?: number }) => {
      setLiveData((prev) => {
        const fallbackTimestamp = Number(prev[prev.length - 1]?.timestamp ?? Date.now()) + 1;
        const mapped = toLivePoint(nextPoint, fallbackTimestamp);
        const updated = [...prev, mapped];
        return updated.slice(-60);
      });
    };

    const appendLog = (nextLog: LogEntry) => {
      setLiveLogEntries((prev) => {
        const updated = [...prev, nextLog];
        return updated.slice(-200);
      });
    };

    const appendMetricsFromLog = (nextLog: LogEntry) => {
      // Use receive-time second buckets so bursts show as values > 1.
      const secondBucket = Math.floor(Date.now() / 1000);
      setLiveData((prev) => {
        const updated = [...prev];
        const last = updated[updated.length - 1];
        if (last && Number(last.timestamp) === secondBucket) {
          const lastPoint = { ...last };
          lastPoint.throughput = (lastPoint.throughput || 0) + 1;
          if (nextLog.level === "ERROR") {
            lastPoint.errors = (lastPoint.errors || 0) + 1;
          }
          updated[updated.length - 1] = lastPoint;
          return [...updated];
        }

        updated.push({
          timestamp: secondBucket,
          throughput: 1,
          errors: nextLog.level === "ERROR" ? 1 : 0,
        });
        return updated.slice(-60);
      });
    };

    const handleStreamPayload = (payload: StreamPayload) => {
      if (!isMounted) return;

      if (isLogLike(payload)) {
        const log = toLogEntry(payload);
        appendLog(log);
        appendMetricsFromLog(log);
        return;
      }

      const wrapped = payload as Exclude<StreamPayload, LogEntry>;

      if (wrapped.log && isLogLike(wrapped.log)) {
        const log = toLogEntry(wrapped.log);
        appendLog(log);
        appendMetricsFromLog(log);
      }

      if (wrapped.point) {
        appendLivePoint(wrapped.point);
        return;
      }

      if (wrapped.errors !== undefined || wrapped.throughput !== undefined) {
        appendLivePoint({
          timestamp: wrapped.timestamp,
          errors: wrapped.errors,
          throughput: wrapped.throughput,
        });
      }
    };

    const clearReconnectTimeout = () => {
      if (!reconnectTimeout) return;
      clearTimeout(reconnectTimeout);
      reconnectTimeout = null;
    };

    const scheduleReconnect = () => {
      if (!isMounted) return;
      clearReconnectTimeout();
      reconnectTimeout = setTimeout(() => {
        void connectSse();
      }, 3000);
    };

    const processSseData = (eventName: string, data: string) => {
      if (!data) return;

      try {
        if (eventName === "log") {
          const parsed = JSON.parse(data) as StreamLogDocument;
          const log = toLogEntryFromDocument(parsed);
          appendLog(log);
          appendMetricsFromLog(log);
          return;
        }

        const parsed = JSON.parse(data) as StreamPayload;
        handleStreamPayload(parsed);
      } catch {
        // Ignore malformed stream payload.
      }
    };

    const connectSse = async () => {
      if (!isMounted) return;

      clearReconnectTimeout();
      if (abortController) {
        abortController.abort();
      }

      abortController = new AbortController();

      const streamUrl = api.getLiveLogsStreamUrl({ projectId: selectedProject?.id });

      const headers = new Headers();
      headers.set("Accept", "text/event-stream");
      const token = tokenStore.get();
      if (token) headers.set("Authorization", `Bearer ${token}`);
      if (selectedProject?.id) headers.set("X-Project-Id", selectedProject.id);

      try {
        const response = await fetch(streamUrl, {
          method: "GET",
          headers,
          signal: abortController.signal,
          cache: "no-store",
        });

        if (!response.ok || !response.body) {
          throw new Error(`SSE stream failed with status ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (isMounted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
          const events = buffer.split("\n\n");
          buffer = events.pop() || "";

          for (const rawEvent of events) {
            let eventName = "message";
            const dataLines: string[] = [];

            for (const line of rawEvent.split("\n")) {
              if (!line || line.startsWith(":")) continue;
              if (line.startsWith("event:")) {
                eventName = line.slice(6).trim();
              } else if (line.startsWith("data:")) {
                dataLines.push(line.slice(5).trimStart());
              }
            }

            processSseData(eventName, dataLines.join("\n"));
          }
        }

        if (isMounted) {
          scheduleReconnect();
        }
      } catch (error) {
        const wasAborted = error instanceof DOMException && error.name === "AbortError";
        if (!wasAborted) {
          scheduleReconnect();
        }
      }
    };

    const bootstrapAndConnect = async () => {
      try {
        const window = resolveLiveBootstrapWindow(timeRange, customDateRange);

        const searchResult = await api.searchLogs({
          from: window.from,
          to: window.to,
          page: 0,
          size: 200,
        });

        const latestLogs = [...(searchResult.content || [])].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        if (!isMounted) return;

        setLiveLogEntries(latestLogs);
        setLiveData(buildMetricsFromLogs(latestLogs));
      } catch {
        if (isMounted) {
          setLiveLogEntries([]);
          setLiveData([]);
        }
      }

      if (isMounted) {
        await connectSse();
      }
    };

    void bootstrapAndConnect();

    return () => {
      isMounted = false;
      clearReconnectTimeout();
      if (abortController) {
        abortController.abort();
      }
    };
  }, [selectedProject?.id, timeRange, customDateRange.from?.getTime(), customDateRange.to?.getTime()]);

  const handleCopyTraceId = (traceId: string) => {
    navigator.clipboard.writeText(traceId);
    setCopiedTraceId(traceId);
    setTimeout(() => setCopiedTraceId(null), 2000);
  };

  const LevelColors: Record<string, string> = {
    ERROR: "bg-red-900/30 border-red-900 text-red-100",
    WARN: "bg-yellow-900/30 border-yellow-900 text-yellow-100",
    INFO: "bg-blue-900/30 border-blue-900 text-blue-100",
    DEBUG: "bg-muted border-border text-foreground",
  };

  const CustomTooltip = (props: any) => {
    if (!props.active || !props.payload) return null;
    return (
      <div className="rounded border border-border bg-popover p-2 text-popover-foreground shadow-sm">
        <div className="text-xs text-muted-foreground mb-1">{formatTimeTick(props.label)}</div>
        {props.payload.map((entry: any, index: number) => (
          <div key={index} style={{ color: entry.color }} className="text-xs">
            {entry.name}: {entry.value}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Live Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Live Error Rate */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Live Error Rate</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Updating</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={liveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="timestamp"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={formatTimeTick}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                allowDecimals={false}
                domain={[0, "dataMax + 1"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="errors"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        {/* Live Throughput */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Live Log Throughput</h3>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground">Updating</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={liveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="timestamp"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={formatTimeTick}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                allowDecimals={false}
                domain={[0, "dataMax + 1"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="throughput"
                stroke="#22c55e"
                fill="#22c55e"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Terminal Log Feed */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-foreground">Live Log Stream</h3>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-muted-foreground">Live</span>
          </div>
        </div>

        <div className="h-96 overflow-y-auto rounded border border-border bg-muted/40 p-4 space-y-1 font-mono text-xs">
          {[...liveLogEntries].reverse().map((log, idx) => (
            <div
              key={idx}
              className={`flex items-start gap-2 p-2 rounded transition-all duration-500 ${
                LevelColors[log.level as keyof typeof LevelColors] ||
                "bg-muted border-border text-foreground"
              } border border-opacity-50 group hover:bg-opacity-50`}
              style={{
                animation: `fadeIn 0.5s ease-in-out ${idx * 0.05}s both`,
              }}
            >
              <span className="text-muted-foreground flex-shrink-0">
                [{log.timestamp.toLocaleTimeString()}]
              </span>
              <Badge variant="outline" className="flex-shrink-0 h-5">
                {log.level}
              </Badge>
              <span className="text-muted-foreground flex-shrink-0">{log.service}</span>
              <span className="flex-1 text-foreground truncate">{log.message}</span>
              <Button
                size="sm"
                variant="ghost"
                className="flex-shrink-0 opacity-0 group-hover:opacity-100 h-5 px-1"
                onClick={() => handleCopyTraceId(log.traceId)}
              >
                {copiedTraceId === log.traceId ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                )}
              </Button>
            </div>
          ))}
        </div>

        <style>{`
          @keyframes fadeIn {
            from {
              opacity: 0;
              transform: translateY(-4px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }
        `}</style>
      </Card>
    </div>
  );
}
