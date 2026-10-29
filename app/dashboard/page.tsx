"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "@/lib/project-context";
import {
  applyLiveLogToDashboard,
  createEmptyDashboardData,
  ensureDashboardSparklines,
  type DashboardData,
} from "@/lib/dashboard-data";
import { isWithinLiveDateWindow, resolveDateWindow } from "@/lib/date-window";
import { formatBucketLabel, resolveTimelineServiceKeys } from "@/lib/error-timeline";
import { useLiveLogStream } from "@/hooks/use-live-log-stream";
import { useLiveStreamPreference } from "@/lib/live-stream-context";
import { useSmoothNumber } from "@/hooks/use-smooth-number";
import { DashboardMiniSparkline } from "@/components/dashboard-mini-sparkline";
import { DashboardErrorRateChart } from "@/components/dashboard-error-rate-chart";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { api } from "@/lib/api";
import { TrendingUp, TrendingDown, Brain, LayoutDashboard } from "lucide-react";
import { PageErrorBanner } from "@/components/page-error-banner";
import { PageHeader, PageShell, LiveStatusPill } from "@/components/page-shell";
import { PanelCard } from "@/components/panel-card";
import { StatCard } from "@/components/stat-card";
import { AnalyticsChartTooltip } from "@/components/analytics-chart-tooltip";
import { chartAxisTick, chartGrid, chartMarginWithLegend } from "@/lib/recharts-theme";

export default function Dashboard() {
  const { selectedProject, timeRange, customDateRange, applyCustomWindow } = useProject();
  const { sseEnabled } = useLiveStreamPreference();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loadError, setLoadError] = useState("");

  const dateWindow = useMemo(
    () => resolveDateWindow(timeRange, customDateRange),
    [timeRange, customDateRange.from?.getTime(), customDateRange.to?.getTime()]
  );
  const dateWindowRef = useRef(dateWindow);
  dateWindowRef.current = dateWindow;

  useEffect(() => {
    if (!selectedProject?.id) {
      setDashboardData(null);
      return;
    }

    if (!dateWindow) {
      setDashboardData(createEmptyDashboardData());
      setLoadError("");
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadError("");
      try {
        const data = await api.getDashboardData(timeRange, customDateRange);
        if (!cancelled) setDashboardData(ensureDashboardSparklines(data as DashboardData));
      } catch (error) {
        if (!cancelled) {
          setDashboardData(null);
          setLoadError(error instanceof Error ? error.message : "Failed to load dashboard");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, timeRange, customDateRange.from?.getTime(), customDateRange.to?.getTime(), dateWindow?.from, dateWindow?.to]);

  const timeRangeRef = useRef(timeRange);
  timeRangeRef.current = timeRange;

  const onLiveLog = useCallback((log: DashboardData["logs"][number]) => {
    const window = dateWindowRef.current;
    if (!window || !isWithinLiveDateWindow(log.timestamp, timeRangeRef.current, window)) {
      return;
    }
    setDashboardData((current) => (current ? applyLiveLogToDashboard(current, log) : current));
  }, []);

  const { status: streamStatus } = useLiveLogStream({
    projectId: selectedProject?.id,
    enabled: sseEnabled && !!selectedProject?.id && dashboardData !== null && dateWindow !== null,
    onLog: onLiveLog,
  });

  const stats = useMemo(() => {
    const fallback = {
      totalLogs: 0,
      totalLogsChangePercent: 0,
      errorCount: 0,
      errorChangePercent: 0,
      totalServices: [] as string[],
      serviceCount: 0,
      affectedServices: { count: 0, services: [] as string[] },
      aiAnalysesRun: 0,
      aiCached: 0,
      aiSaved: 0,
    };
    return dashboardData?.stats || fallback;
  }, [dashboardData]);

  const errorTimelineData = dashboardData?.errorTimeline || [];
  const distributionData = dashboardData?.distribution || [];
  const levelVolumeData = dashboardData?.levelVolume || [];
  const topErrorsData = dashboardData?.topErrors || [];
  const issuesData = dashboardData?.issues || [];
  const heatmapData = dashboardData?.heatmap || [];
  const heatmapMeta = dashboardData?.heatmapMeta;
  const heatmapBucketCount = heatmapMeta?.bucketCount ?? 24;
  const statSparklines = dashboardData?.statSparklines;

  const smoothTotalLogs = useSmoothNumber(stats.totalLogs);
  const smoothErrorCount = useSmoothNumber(stats.errorCount);
  const smoothAffectedCount = useSmoothNumber(stats.affectedServices.count);
  const smoothAiAnalyses = useSmoothNumber(stats.aiAnalysesRun);

  // Light mode colors for services
  const ServiceColors: Record<string, string> = {
    "api-gateway": "#3b82f6",
    "auth-service": "#ef4444",
    "payment-service": "#f97316",
    "admin-service": "#a855f7",
    "user-service": "#22c55e",
  };

  // Light mode colors for log levels
  const LevelColors: Record<string, string> = {
    ERROR: "#dc2626",
    WARN: "#d97706",
    INFO: "#2563eb",
    DEBUG: "#64748b",
  };

  const servicePalette = [
    "#3b82f6",
    "#ef4444",
    "#f97316",
    "#a855f7",
    "#22c55e",
    "#06b6d4",
    "#eab308",
    "#ec4899",
  ];

  const timelineServiceKeys = resolveTimelineServiceKeys(
    errorTimelineData,
    stats.totalServices.length > 0 ? stats.totalServices : []
  );

  const getServiceColor = (service: string, index: number): string => {
    if (ServiceColors[service]) return ServiceColors[service];
    return servicePalette[index % servicePalette.length];
  };

  const heatmapServices = (
    heatmapData.length > 0
      ? Array.from(new Set(heatmapData.map((cell) => cell.service)))
      : stats.totalServices.length > 0
        ? stats.totalServices
        : []
  ).filter((service) => service && service.length > 0);

  const heatmapBucketLabel = (bucketIndex: number): string => {
    if (!heatmapMeta) return `Bucket ${bucketIndex}`;
    const ms = heatmapMeta.windowFromMs + bucketIndex * heatmapMeta.bucketMs;
    return formatBucketLabel(new Date(ms).toISOString(), heatmapMeta.bucketMs);
  };

  const heatmapValues = heatmapData.map((cell) => cell.value);
  const maxHeatmapValue = heatmapValues.length > 0 ? Math.max(...heatmapValues) : 0;
  const heatmapLookup = new Map(heatmapData.map((cell) => [`${cell.service}-${cell.hour}`, cell.value]));

  const heatmapColorClass = (value: number): string => {
    if (value <= 0) return "bg-gray-100";
    if (maxHeatmapValue <= 0) return "bg-blue-200";

    const ratio = value / maxHeatmapValue;
    if (ratio <= 0.2) return "bg-blue-200";
    if (ratio <= 0.45) return "bg-amber-200";
    if (ratio <= 0.75) return "bg-orange-400";
    return "bg-red-500";
  };

  const CustomTooltip = AnalyticsChartTooltip;

  const formatLogCount = (value: number): string => {
    const abs = Math.abs(value);

    if (abs >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
    }

    if (abs >= 1_000) {
      return `${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
    }

    return value.toLocaleString();
  };

  return (
    <PageShell className="space-y-6">
      <PageErrorBanner message={loadError} />
      <PageHeader
        icon={LayoutDashboard}
        eyebrow="Overview"
        title={selectedProject?.name || "Dashboard"}
        description={
          selectedProject?.id
            ? `Monitoring ${stats.serviceCount || 0} services in this project`
            : undefined
        }
        actions={<LiveStatusPill status={streamStatus} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total logs"
          value={formatLogCount(smoothTotalLogs)}
          hint={<span className="text-emerald-600">+{stats.totalLogsChangePercent}% vs last period</span>}
          aside={<DashboardMiniSparkline data={statSparklines?.totalLogs ?? []} color="#16a34a" />}
        />
        <StatCard
          label="Error count"
          value={smoothErrorCount.toLocaleString()}
          hint={
            <Badge className="bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200">
              ↑ {stats.errorChangePercent}% spike
            </Badge>
          }
          aside={<DashboardMiniSparkline data={statSparklines?.errorCount ?? []} color="#dc2626" />}
        />
        <StatCard
          label="Affected services"
          value={`${smoothAffectedCount} / ${stats.serviceCount}`}
          hint={
            <span className="line-clamp-2 text-orange-600 dark:text-orange-400">
              {stats.affectedServices.services.join(", ") || "None"}
            </span>
          }
          aside={<DashboardMiniSparkline data={statSparklines?.affectedServices ?? []} color="#ea580c" />}
        />
        <StatCard
          label="AI analyses"
          value={smoothAiAnalyses}
          hint={<span className="text-blue-600 dark:text-blue-400">{stats.aiCached} cached</span>}
          aside={<DashboardMiniSparkline data={statSparklines?.aiAnalyses ?? []} color="#2563eb" />}
        />
      </div>

      {/* Row 2: Main Charts */}
      <div className="grid grid-cols-12 gap-4">
        {/* Error Rate Over Time */}
        <PanelCard
          className="col-span-5"
          title="Error rate over time"
          description="Drag on the chart to narrow the dashboard time window."
        >
          <DashboardErrorRateChart
            data={errorTimelineData}
            dateWindow={dateWindow}
            serviceKeys={timelineServiceKeys}
            getServiceColor={getServiceColor}
            onBrushRange={(from, to) => void applyCustomWindow(from, to)}
            customTooltip={CustomTooltip}
          />
        </PanelCard>

        <PanelCard className="col-span-4" title="Error distribution by service">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={false}
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "#ffffff",
                  border: "1px solid #e5e7eb",
                  color: "#000",
                }}
              />
              <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
                <tspan x="50%" dy="-0.3em" fontSize="12" fill="#6b7280">
                  Total Errors
                </tspan>
                <tspan x="50%" dy="1.2em" fontSize="20" fill="#1f2937" fontWeight="bold">
                  {stats.errorCount.toLocaleString()}
                </tspan>
              </text>
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-1 text-xs">
            {distributionData.map((item) => (
              <div key={item.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-muted-foreground">{item.name}</span>
                </div>
                <span className="text-foreground font-medium">{item.value}%</span>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard className="col-span-3" title="Log volume by level">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={levelVolumeData} margin={chartMarginWithLegend}>
              <CartesianGrid {...chartGrid} />
              <XAxis dataKey="name" tick={chartAxisTick} axisLine={false} tickLine={false} />
              <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={36} allowDecimals={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]}>
                {levelVolumeData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      LevelColors[entry.name as keyof typeof LevelColors] || "#3b82f6"
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </PanelCard>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PanelCard title="Error heatmap by service × time">
          {heatmapServices.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No errors in this time range.</p>
          ) : (
          <div className="space-y-2 overflow-x-auto">
            {heatmapServices.map((service) => (
              <div key={service} className="flex items-center gap-2 min-w-max">
                <div className="w-32 text-xs text-muted-foreground truncate">{service}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: heatmapBucketCount }, (_, bucket) => {
                    const value = heatmapLookup.get(`${service}-${bucket}`) ?? 0;
                    const bgColor = heatmapColorClass(value);
                    return (
                      <div
                        key={bucket}
                        className={`w-3 h-3 ${bgColor} rounded-sm shrink-0`}
                        title={`${heatmapBucketLabel(bucket)}: ${value} error(s)`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <span>Low</span>
              <div className="flex gap-1">
                <div className="w-3 h-3 bg-gray-100 rounded-sm" />
                <div className="w-3 h-3 bg-blue-200 rounded-sm" />
                <div className="w-3 h-3 bg-amber-200 rounded-sm" />
                <div className="w-3 h-3 bg-orange-400 rounded-sm" />
                <div className="w-3 h-3 bg-red-500 rounded-sm" />
              </div>
              <span>High</span>
            </div>
          </div>
          )}
        </PanelCard>

        <PanelCard title="Top 5 error types">
          {topErrorsData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">No error types in this time range.</p>
          ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topErrorsData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 8, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 12 }} allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                width={180}
                tickFormatter={(name: string) =>
                  name.length > 28 ? `${name.slice(0, 25)}…` : name
                }
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0]?.payload as { name?: string; value?: number };
                  return (
                    <div className="bg-card border border-border rounded p-2 text-xs max-w-sm">
                      <p className="font-medium text-foreground break-words">{row?.name}</p>
                      <p className="text-muted-foreground">{row?.value ?? 0} occurrence(s)</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" fill="#dc2626" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
          )}
        </PanelCard>
      </div>

      <PanelCard title="Recent critical issues">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="text-muted-foreground">Severity</TableHead>
                <TableHead className="text-muted-foreground">Service</TableHead>
                <TableHead className="text-muted-foreground">Error Type</TableHead>
                <TableHead className="text-muted-foreground text-right">Occurrences</TableHead>
                <TableHead className="text-muted-foreground">Trend</TableHead>
                <TableHead className="text-muted-foreground">Last Seen</TableHead>
                <TableHead className="text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {issuesData.slice(0, 5).map((issue) => (
                <TableRow key={issue.id} className="border-border">
                  <TableCell>
                    <Badge
                      className={
                        issue.severity === "CRITICAL"
                          ? "bg-red-100 text-red-800"
                          : issue.severity === "HIGH"
                            ? "bg-orange-100 text-orange-800"
                            : issue.severity === "MEDIUM"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-blue-100 text-blue-800"
                      }
                    >
                      {issue.severity}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{issue.service}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">{issue.errorType}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">
                    {issue.occurrences.toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {issue.severity === "CRITICAL" ? (
                        <TrendingUp className="w-4 h-4 text-red-500" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-green-500" />
                      )}
                      <LineChart width={40} height={20} data={issue.trend.map((v) => ({ value: v }))}>
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={
                            issue.severity === "CRITICAL"
                              ? "#ef4444"
                              : "#22c55e"
                          }
                          strokeWidth={1.5}
                          dot={false}
                        />
                      </LineChart>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm" suppressHydrationWarning>
                    {issue.lastSeen.toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-border text-foreground hover:bg-accent hover:text-accent-foreground"
                      title="soon"
                      disabled
                    >
                      <Brain className="w-3.5 h-3.5 mr-1" />
                      Analyze
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </PanelCard>
    </PageShell>
  );
}
