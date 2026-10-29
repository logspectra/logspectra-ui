"use client";

import { useCallback, useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import { api, resolveDateWindow } from "@/lib/api";
import { useLiveLogStream } from "@/hooks/use-live-log-stream";
import type { LivePoint, LogEntry } from "@/lib/types";
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
import { Copy, Check, Radio } from "lucide-react";
import { PageErrorBanner } from "@/components/page-error-banner";
import { PageHeader, PageShell, LiveStatusPill } from "@/components/page-shell";
import { PanelCard } from "@/components/panel-card";
import { AnalyticsChartTooltip } from "@/components/analytics-chart-tooltip";
import { chartAxisTick, chartGrid, chartMarginWithLegend } from "@/lib/recharts-theme";

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
  const [historyLoadError, setHistoryLoadError] = useState("");

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
      setHistoryLoadError("");
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
      } catch (error) {
        if (!cancelled) {
          setHistoryLoadError(error instanceof Error ? error.message : "Failed to load recent logs");
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

  const CustomTooltip = AnalyticsChartTooltip;

  return (
    <PageShell className="space-y-6">
      <PageHeader
        icon={Radio}
        eyebrow="Realtime"
        title="Live stream"
        description="Per-second throughput and errors from SSE, seeded with recent history."
        actions={<LiveStatusPill status={streamStatus} />}
      />
      <PageErrorBanner message={historyLoadError} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard
          title="Live error rate"
          action={
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              Live
            </span>
          }
        >
          <div className="min-h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={200}>
            <LineChart data={liveData} margin={chartMarginWithLegend}>
              <CartesianGrid {...chartGrid} />
              <XAxis
                type="number"
                dataKey="timestamp"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tick={chartAxisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTimeTick}
              />
              <YAxis
                tick={chartAxisTick}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, "dataMax + 1"]}
                width={32}
              />
              <Tooltip content={<CustomTooltip />} labelFormatter={(v) => formatTimeTick(Number(v))} />
              <Line
                type="monotone"
                dataKey="errors"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
                name="Errors"
              />
            </LineChart>
          </ResponsiveContainer>
          </div>
        </PanelCard>

        <PanelCard title="Live log throughput">
          <div className="min-h-[200px] w-full min-w-0">
            <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={liveData} margin={chartMarginWithLegend}>
              <CartesianGrid {...chartGrid} />
              <XAxis
                dataKey="timestamp"
                tick={chartAxisTick}
                axisLine={false}
                tickLine={false}
                tickFormatter={formatTimeTick}
              />
              <YAxis
                tick={chartAxisTick}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                domain={[0, "dataMax + 1"]}
                width={32}
              />
              <Tooltip content={<CustomTooltip />} labelFormatter={(v) => formatTimeTick(Number(v))} />
              <Area
                type="monotone"
                dataKey="throughput"
                stroke="#16a34a"
                fill="#16a34a"
                fillOpacity={0.35}
                name="Logs/sec"
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
          </div>
        </PanelCard>
      </div>

      <PanelCard title="Live log stream" bodyClassName="min-w-0">
        <div className="h-96 w-full min-w-0 space-y-1 overflow-y-auto overflow-x-auto rounded-lg border border-border/80 bg-muted/30 p-4 font-mono text-xs">
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
      </PanelCard>
    </PageShell>
  );
}
