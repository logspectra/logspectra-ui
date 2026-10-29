"use client";

import { useEffect, useState } from "react";
import { useProject } from "@/lib/project-context";
import {
  ComposedChart,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { resolveDateWindow } from "@/lib/date-window";
import { PageErrorBanner } from "@/components/page-error-banner";

export default function Analytics() {
  const { selectedProject, timeRange, customDateRange } = useProject();
  const [dashboardData, setDashboardData] = useState<Awaited<ReturnType<typeof api.getDashboardData>> | null>(null);
  const [loadError, setLoadError] = useState("");
  const dateWindow = resolveDateWindow(timeRange, customDateRange);

  useEffect(() => {
    if (!selectedProject?.id) {
      setDashboardData(null);
      return;
    }

    if (!dateWindow) {
      setDashboardData(null);
      setLoadError("");
      return;
    }

    let cancelled = false;
    const load = async () => {
      setLoadError("");
      try {
        const data = await api.getDashboardData(timeRange, customDateRange);
        if (!cancelled) setDashboardData(data);
      } catch (error) {
        if (!cancelled) {
          setDashboardData(null);
          setLoadError(error instanceof Error ? error.message : "Failed to load analytics");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, timeRange, customDateRange.from?.getTime(), customDateRange.to?.getTime()]);
  const ServiceColors: Record<string, string> = {
    "api-gateway": "#3b82f6",
    "auth-service": "#ef4444",
    "payment-service": "#f97316",
    "admin-service": "#a855f7",
    "user-service": "#22c55e",
  };

  const servicePalette = ["#3b82f6", "#ef4444", "#f97316", "#a855f7", "#22c55e", "#06b6d4", "#eab308", "#ec4899"];

  const weeklyTrendData = dashboardData?.weeklyTrend || [];
  const weeklyTrendChartData = weeklyTrendData.map((row, index) => ({
    ...row,
    periodKey: `${row.date}-${index}`,
  }));
  const errorTriageData = (dashboardData?.errorTriage || []).map((row, index) => ({
    ...row,
    periodKey: row.periodKey || `${row.period}-${index}`,
  }));
  const aiUsageData = dashboardData?.aiUsage || [];
  const ingestionRateData = dashboardData?.ingestionRate || [];
  const topEndpointsData = (dashboardData?.topEndpoints || []).slice(0, 5);
  const severityMixData = dashboardData?.severityMix || [];

  const trendServices = Array.from(
    new Set(
      weeklyTrendData.flatMap((row) =>
        Object.keys(row).filter((key) => key !== "date" && key !== "errorRate")
      )
    )
  ).filter((service) => weeklyTrendData.some((row) => typeof row[service] === "number"));

  const getServiceColor = (service: string, index: number) => {
    if (ServiceColors[service]) return ServiceColors[service];
    return servicePalette[index % servicePalette.length];
  };

  const CustomTooltip = (props: any) => {
    if (!props.active || !props.payload) return null;
    return (
      <div className="rounded border border-border bg-popover p-2 text-popover-foreground shadow-sm">
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
      <PageErrorBanner message={loadError} />
      {!dateWindow && (
        <p className="text-sm text-muted-foreground">Select a valid time range to load analytics.</p>
      )}
      {/* Row 1: Error Trends */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-4">Error Trends</h2>
        <Card className="p-4">
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart data={weeklyTrendChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="periodKey"
                tickFormatter={(_, index) => weeklyTrendChartData[index]?.date ?? ""}
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend />

              {/* Bars for services */}
              {trendServices.map((service, index) => (
                <Bar
                  key={service}
                  yAxisId="left"
                  dataKey={service}
                  fill={getServiceColor(service, index)}
                  fillOpacity={0.7}
                />
              ))}
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="errorRate"
                stroke="#fbbf24"
                strokeWidth={2}
                dot={false}
                name="Error Rate (%)"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 2: Error triage & AI Usage */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="mb-4 flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                ERROR Triage Over Time
              </h3>
              <p className="mt-1 text-xs text-muted-foreground">
                Open vs resolved ERROR logs in the selected window. Resolve rows in{" "}
                <Link href="/explorer" className="text-primary underline-offset-2 hover:underline">
                  Explorer
                </Link>{" "}
                to update triage state.
              </p>
            </div>
          </div>
          {errorTriageData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-16 text-center">
              No ERROR logs in this range.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={errorTriageData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis
                  dataKey="periodKey"
                  tickFormatter={(_, index) => errorTriageData[index]?.period ?? ""}
                  tick={{ fill: "#71717a", fontSize: 11 }}
                />
                <YAxis
                  tick={{ fill: "#71717a", fontSize: 12 }}
                  allowDecimals={false}
                  label={{ value: "ERROR count", angle: -90, position: "insideLeft" }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="open"
                  stackId="1"
                  stroke="#ef4444"
                  fill="#ef4444"
                  fillOpacity={0.65}
                  name="Open"
                />
                <Area
                  type="monotone"
                  dataKey="resolved"
                  stackId="1"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.55}
                  name="Resolved"
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            AI Analysis Usage
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aiUsageData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="date"
                tick={{ fill: "#71717a", fontSize: 12 }}
              />
              <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="requested"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                name="Analyses Requested"
              />
              <Line
                type="monotone"
                dataKey="cached"
                stroke="#22c55e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={false}
                name="Cache Hits"
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Row 3: Ingestion Rate, Top Endpoints, Dependency Flow */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Log Ingestion Rate
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={ingestionRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="hour"
                tick={{ fill: "#71717a", fontSize: 11 }}
              />
              <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="INFO"
                stackId="1"
                stroke="#3b82f6"
                fill="#3b82f6"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="WARN"
                stackId="1"
                stroke="#eab308"
                fill="#eab308"
                fillOpacity={0.6}
              />
              <Area
                type="monotone"
                dataKey="ERROR"
                stackId="1"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.6}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>

        <Card className="py-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Top 5 Affected Endpoints
          </h3>
          {topEndpointsData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
              No ERROR logs with an endpoint in this range. HTTP traffic gets endpoint from LogSpectra starter MDC; scheduled jobs should use LogSpectraMdc.runWithRequestContext.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={topEndpointsData}
                layout="vertical"
                margin={{ top: 5, right: 15, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                <XAxis type="number" tick={{ fill: "#71717a", fontSize: 12 }} />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fill: "#71717a", fontSize: 11 }}
                  width={195}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" fill="#dc2626" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            Error Severity Mix Over Time
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={severityMixData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="period"
                tick={{ fill: "#71717a", fontSize: 11 }}
              />
              <YAxis tick={{ fill: "#71717a", fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="CRITICAL" stackId="1" fill="#dc2626" fillOpacity={0.8}/>
              <Bar dataKey="HIGH" stackId="1" fill="#ea580c" fillOpacity={0.8} />
              <Bar dataKey="MEDIUM" stackId="1" fill="#eab308" fillOpacity={0.8} />
              <Bar dataKey="LOW" stackId="1" fill="#3b82f6" fillOpacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

    </div>
  );
}
