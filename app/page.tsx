"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useProject } from "@/lib/project-context";
import {
  applyLiveLogToDashboard,
  createEmptyDashboardData,
  ensureDashboardSparklines,
  type DashboardData,
} from "@/lib/dashboard-data";
import { isWithinDateWindow, resolveDateWindow } from "@/lib/date-window";
import { resolveTimelineServiceKeys } from "@/lib/error-timeline";
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
import { TrendingUp, TrendingDown, Brain } from "lucide-react";

export default function Dashboard() {
  const { selectedProject, timeRange, customDateRange, applyCustomWindow } = useProject();
  const { sseEnabled } = useLiveStreamPreference();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);

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
      return;
    }

    let cancelled = false;
    const load = async () => {
      try {
        const data = await api.getDashboardData(timeRange, customDateRange);
        if (!cancelled) setDashboardData(ensureDashboardSparklines(data as DashboardData));
      } catch {
        if (!cancelled) setDashboardData(null);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, timeRange, customDateRange.from?.getTime(), customDateRange.to?.getTime(), dateWindow?.from, dateWindow?.to]);

  const onLiveLog = useCallback((log: DashboardData["logs"][number]) => {
    const window = dateWindowRef.current;
    if (!window || !isWithinDateWindow(log.timestamp, window)) {
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
    stats.totalServices.length > 0
      ? stats.totalServices
      : Array.from(new Set(heatmapData.map((cell) => cell.service)))
  ).filter((service) => service && service.length > 0);

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

  const CustomTooltip = (props: any) => {
    if (!props.active || !props.payload) return null;
    return (
      <div className="bg-card border border-border rounded p-2">
        {props.payload.map((entry: any, index: number) => (
          <div key={index} style={{ color: entry.color }} className="text-xs">
            {entry.name}: {entry.value}
          </div>
        ))}
      </div>
    );
  };

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
    <div className="space-y-6">
      {/* Project Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{selectedProject?.name || "Dashboard"}</h1>
          <p className="text-sm text-muted-foreground mt-1">Project ID: {selectedProject?.id}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span
              className={`h-2 w-2 rounded-full ${
                streamStatus === "live"
                  ? "bg-green-500 animate-pulse"
                  : streamStatus === "idle"
                    ? "bg-zinc-500"
                    : "bg-amber-500 animate-pulse"
              }`}
            />
            <span>
              {streamStatus === "live"
                ? "Live updates on"
                : streamStatus === "connecting"
                  ? "Connecting live stream…"
                  : streamStatus === "reconnecting"
                    ? "Reconnecting…"
                    : "Live updates off"}
            </span>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Services</p>
            <p className="text-2xl font-bold text-foreground">{stats.serviceCount || 0}</p>
          </div>
        </div>
      </div>

      {/* Row 1: Stat Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="bg-card border-border p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Logs</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                {formatLogCount(smoothTotalLogs)}
              </p>
              <p className="text-xs text-green-600 mt-2">
                +{stats.totalLogsChangePercent}% vs last period
              </p>
            </div>
            <DashboardMiniSparkline
              data={statSparklines?.totalLogs ?? []}
              color="#16a34a"
            />
          </div>
        </Card>

        <Card className="bg-card border-border p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Error Count</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                {smoothErrorCount.toLocaleString()}
              </p>
              <div className="flex items-center gap-1 mt-2">
                <Badge className="bg-red-100 text-red-800">
                  ↑ {stats.errorChangePercent}% spike
                </Badge>
              </div>
            </div>
            <DashboardMiniSparkline
              data={statSparklines?.errorCount ?? []}
              color="#dc2626"
            />
          </div>
        </Card>

        <Card className="bg-card border-border p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Affected Services</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                {smoothAffectedCount} of {stats.serviceCount}
              </p>
              <p className="text-xs text-orange-600 mt-2">
                {stats.affectedServices.services.join(", ")}
              </p>
            </div>
            <DashboardMiniSparkline
              data={statSparklines?.affectedServices ?? []}
              color="#ea580c"
            />
          </div>
        </Card>

        <Card className="bg-card border-border p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground">AI Analyses Run</p>
              <p className="text-3xl font-bold text-foreground mt-2 tabular-nums">
                {smoothAiAnalyses}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                {stats.aiCached} cached
              </p>
            </div>
            <DashboardMiniSparkline
              data={statSparklines?.aiAnalyses ?? []}
              color="#2563eb"
            />
          </div>
        </Card>
      </div>

      {/* Row 2: Main Charts */}
      <div className="grid grid-cols-12 gap-4">
        {/* Error Rate Over Time */}
        <Card className="col-span-5 bg-card border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Error Rate Over Time</h3>
          <DashboardErrorRateChart
            data={errorTimelineData}
            dateWindow={dateWindow}
            serviceKeys={timelineServiceKeys}
            getServiceColor={getServiceColor}
            onBrushRange={(from, to) => void applyCustomWindow(from, to)}
            customTooltip={CustomTooltip}
          />
        </Card>

        {/* Error Distribution by Service */}
        <Card className="col-span-4 bg-card border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Error Distribution by Service</h3>
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
        </Card>

        {/* Log Volume by Level */}
        <Card className="col-span-3 bg-card border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Log Volume by Level</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={levelVolumeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
              />
              <YAxis
                tick={{ fill: "#6b7280", fontSize: 12 }}
                axisLine={false}
              />
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
        </Card>
      </div>

      {/* Row 3: Secondary Charts */}
      <div className="grid grid-cols-2 gap-4">
        {/* Error Heatmap */}
        <Card className="bg-card border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Error Heatmap by Service × Hour</h3>
          <div className="space-y-2">
            {heatmapServices.map((service) => (
              <div key={service} className="flex items-center gap-2">
                <div className="w-32 text-xs text-muted-foreground truncate">{service}</div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 24 }, (_, hour) => {
                    const value = heatmapLookup.get(`${service}-${hour}`) ?? 0;
                    const bgColor = heatmapColorClass(value);
                    return (
                      <div
                        key={hour}
                        className={`w-3 h-3 ${bgColor} rounded-sm`}
                        title={`Hour ${hour}: ${value} errors`}
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
        </Card>

        {/* Top Error Types */}
        <Card className="bg-card border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top 5 Error Types</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart
              data={topErrorsData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 200, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" tick={{ fill: "#6b7280", fontSize: 12 }} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fill: "#6b7280", fontSize: 11 }}
                width={195}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" fill="#dc2626" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 4: Recent Critical Issues Table */}
      <Card className="bg-card border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4">Recent Critical Issues</h3>
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
      </Card>

    </div>
  );
}
