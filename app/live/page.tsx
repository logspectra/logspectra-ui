"use client";

import { useCallback, useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import { api, resolveDateWindow } from "@/lib/api";
import { useLiveLogStream } from "@/hooks/use-live-log-stream";
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

const formatTimeTick = (timestamp: number | string) => {
  const numeric = typeof timestamp === "number" ? timestamp : Number(timestamp);
  if (Number.isNaN(numeric)) return "--:--:--";
  return new Date(numeric * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
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

  const appendMetricsFromLog = useCallback((nextLog: LogEntry) => {
    const secondBucket = Math.floor(Date.now() / 1000);
    setLiveData((prev) => {
      const bySecond = new Map<number, LivePoint>();
      for (const point of prev) {
        bySecond.set(Number(point.timestamp), { ...point });
      }
      for (let s = secondBucket - 59; s <= secondBucket; s++) {
        if (!bySecond.has(s)) {
          bySecond.set(s, { timestamp: s, errors: 0, throughput: 0 });
        }
      }
      const current = bySecond.get(secondBucket)!;
      current.throughput = (current.throughput || 0) + 1;
      if (nextLog.level === "ERROR") {
        current.errors = (current.errors || 0) + 1;
      }
      bySecond.set(secondBucket, current);
      return Array.from(bySecond.entries())
        .sort((a, b) => a[0] - b[0])
        .map(([, value]) => value);
    });
  }, []);

  const onLiveLog = useCallback(
    (log: LogEntry) => {
      setLiveLogEntries((prev) => [...prev, log].slice(-200));
      appendMetricsFromLog(log);
    },
    [appendMetricsFromLog]
  );

  const { status: streamStatus } = useLiveLogStream({
    projectId: selectedProject?.id,
    enabled: !!selectedProject?.id,
    onLog: onLiveLog,
  });

  useEffect(() => {
    if (!selectedProject?.id) {
      setLiveLogEntries([]);
      setLiveData([]);
    }
  }, [selectedProject?.id]);

  useEffect(() => {
    if (!selectedProject?.id) return;

    let cancelled = false;

    const loadHistory = async () => {
      try {
        const resolved = resolveDateWindow(timeRange, customDateRange);
        if (!resolved) {
          if (!cancelled) {
            setLiveLogEntries([]);
            setLiveData([]);
          }
          return;
        }
        const searchResult = await api.searchLogs({
          from: resolved.from,
          to: resolved.to,
          page: 0,
          size: 200,
          projectId: selectedProject.id,
        });

        const latestLogs = [...(searchResult.content || [])].sort(
          (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
        );
        if (cancelled) return;
        setLiveLogEntries(latestLogs);
        setLiveData(buildMetricsFromLogs(latestLogs));
      } catch {
        if (!cancelled) {
          setLiveLogEntries([]);
          setLiveData([]);
        }
      }
    };

    void loadHistory();
    return () => {
      cancelled = true;
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

  const streamStatusLabel =
    streamStatus === "live"
      ? "SSE connected"
      : streamStatus === "connecting"
        ? "Connecting…"
        : streamStatus === "reconnecting"
          ? "Reconnecting…"
          : "Select a project";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <span
          className={`h-2 w-2 rounded-full ${
            streamStatus === "live" ? "bg-green-500 animate-pulse" : streamStatus === "idle" ? "bg-zinc-500" : "bg-amber-500 animate-pulse"
          }`}
        />
        <span>{streamStatusLabel}</span>
      </div>
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
            <LineChart data={liveData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                type="number"
                dataKey="timestamp"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={formatTimeTick}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 10 }}
                allowDecimals={false}
                domain={[0, "dataMax + 1"]}
              />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="errors"
                stroke="#ef4444"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
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
