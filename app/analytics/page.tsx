"use client";

import { useEffect, useMemo, useState } from "react";
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
import { BarChart3 } from "lucide-react";
import { PanelCard } from "@/components/panel-card";
import { PageHeader, PageSection, PageShell } from "@/components/page-shell";
import { AnalyticsChartTooltip } from "@/components/analytics-chart-tooltip";
import { AnalyticsErrorTriageChart } from "@/components/analytics-error-triage-chart";
import { PageErrorBanner } from "@/components/page-error-banner";
import { api } from "@/lib/api";
import { createEmptyDashboardData } from "@/lib/dashboard-data";
import { resolveDateWindow } from "@/lib/date-window";
import {
  chartAxisTick,
  chartAxisTickSm,
  chartGrid,
  chartLegendStyle,
  chartMargin,
  chartMarginWithLegend,
} from "@/lib/recharts-theme";

const ServiceColors: Record<string, string> = {
  "api-gateway": "#3b82f6",
  "auth-service": "#ef4444",
  "payment-service": "#f97316",
  "admin-service": "#a855f7",
  "user-service": "#22c55e",
};

const servicePalette = ["#3b82f6", "#ef4444", "#f97316", "#a855f7", "#22c55e", "#06b6d4", "#eab308", "#ec4899"];

export default function Analytics() {
  const { selectedProject, timeRange, customDateRange } = useProject();
  const [dashboardData, setDashboardData] = useState<Awaited<ReturnType<typeof api.getDashboardData>> | null>(
    null
  );
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
          setDashboardData(createEmptyDashboardData());
          setLoadError(error instanceof Error ? error.message : "Failed to load analytics");
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [selectedProject?.id, timeRange, customDateRange.from?.getTime(), customDateRange.to?.getTime()]);

  const emptyCharts = createEmptyDashboardData();
  const chartSource = dashboardData ?? emptyCharts;

  const weeklyTrendData = chartSource.weeklyTrend || [];
  const weeklyTrendChartData = weeklyTrendData.map((row, index) => ({
    ...row,
    periodKey: `${row.date}-${index}`,
  }));
  const errorTriageData = chartSource.errorTriage || [];
  const aiUsageData = chartSource.aiUsage || [];
  const ingestionRateData = chartSource.ingestionRate || [];
  const topEndpointsData = (chartSource.topEndpoints || []).slice(0, 5);
  const severityMixData = chartSource.severityMix || [];

  const trendServices = useMemo(
    () =>
      Array.from(
        new Set(
          weeklyTrendData.flatMap((row) =>
            Object.keys(row).filter((key) => key !== "date" && key !== "errorRate")
          )
        )
      ).filter((service) => weeklyTrendData.some((row) => typeof row[service] === "number")),
    [weeklyTrendData]
  );

  const getServiceColor = (service: string, index: number) => {
    if (ServiceColors[service]) return ServiceColors[service];
    return servicePalette[index % servicePalette.length];
  };

  const showCharts = !!dateWindow && !!selectedProject?.id;

  return (
    <PageShell>
      <PageHeader
        icon={BarChart3}
        eyebrow="Insights"
        title="Analytics"
        description="Error trends, triage, ingestion, and severity for the selected project and time range."
      />

      <PageErrorBanner message={loadError} />

      {!dateWindow && (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
          Select a valid time range to load analytics.
        </p>
      )}

      {showCharts ? (
        <>
          <PageSection title="Error trends">
            <PanelCard
              title="Service errors & error rate"
              description="Stacked error volume by service with overall error rate overlay."
            >
              {weeklyTrendChartData.length === 0 ? (
                <div className="flex h-[320px] items-center justify-center text-sm text-muted-foreground">
                  No trend data for this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <ComposedChart data={weeklyTrendChartData} margin={chartMarginWithLegend}>
                    <CartesianGrid {...chartGrid} />
                    <XAxis
                      dataKey="periodKey"
                      tick={chartAxisTick}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(_, index) => weeklyTrendChartData[index]?.date ?? ""}
                    />
                    <YAxis
                      yAxisId="left"
                      tick={chartAxisTick}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={chartAxisTick}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                    />
                    <Tooltip content={<AnalyticsChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                    {trendServices.map((service, index) => (
                      <Bar
                        key={service}
                        yAxisId="left"
                        dataKey={service}
                        fill={getServiceColor(service, index)}
                        fillOpacity={0.75}
                        radius={[2, 2, 0, 0]}
                        maxBarSize={48}
                      />
                    ))}
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="errorRate"
                      stroke="#ca8a04"
                      strokeWidth={2.5}
                      dot={false}
                      name="Error rate (%)"
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </PanelCard>
          </PageSection>

          <section className="grid gap-4 lg:grid-cols-2">
            <PanelCard
              title="Error triage over time"
              description="Open vs resolved ERROR logs by timestamp. Resolve rows in Explorer to update counts."
            >
              <AnalyticsErrorTriageChart data={errorTriageData} />
            </PanelCard>

            <PanelCard
              title="AI analysis usage"
              description="Requested analyses vs cache hits from the AI pipeline."
            >
              {aiUsageData.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  No AI usage in this range.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={aiUsageData} margin={chartMarginWithLegend}>
                    <CartesianGrid {...chartGrid} />
                    <XAxis dataKey="date" tick={chartAxisTick} axisLine={false} tickLine={false} />
                    <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                    <Tooltip content={<AnalyticsChartTooltip />} />
                    <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                    <Line
                      type="monotone"
                      dataKey="requested"
                      stroke="#2563eb"
                      strokeWidth={2}
                      dot={false}
                      name="Requested"
                      isAnimationActive={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="cached"
                      stroke="#16a34a"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                      name="Cache hits"
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </PanelCard>
          </section>

          <PageSection title="Volume & impact">
            <div className="grid gap-4 lg:grid-cols-3">
              <PanelCard title="Log ingestion rate" description="INFO, WARN, and ERROR volume over time.">
                {ingestionRateData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    No ingestion data for this range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={ingestionRateData} margin={chartMarginWithLegend}>
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="hour" tick={chartAxisTickSm} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                      <Tooltip content={<AnalyticsChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                      <Area type="monotone" dataKey="INFO" stackId="1" stroke="#2563eb" fill="#2563eb" fillOpacity={0.35} name="INFO" isAnimationActive={false} />
                      <Area type="monotone" dataKey="WARN" stackId="1" stroke="#ca8a04" fill="#ca8a04" fillOpacity={0.35} name="WARN" isAnimationActive={false} />
                      <Area type="monotone" dataKey="ERROR" stackId="1" stroke="#dc2626" fill="#dc2626" fillOpacity={0.4} name="ERROR" isAnimationActive={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </PanelCard>

              <PanelCard
                title="Top affected endpoints"
                description="ERROR count by HTTP route (from LogSpectra MDC)."
              >
                {topEndpointsData.length === 0 ? (
                  <div className="flex min-h-[280px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-muted/20 px-4 text-center">
                    <p className="text-sm font-medium text-foreground">No endpoint-tagged errors</p>
                    <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
                      Enable endpoint on services via LogSpectra starter MDC, or use runWithRequestContext for jobs.
                    </p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={topEndpointsData}
                      layout="vertical"
                      margin={{ ...chartMargin, left: 8, right: 20 }}
                    >
                      <CartesianGrid {...chartGrid} horizontal={false} />
                      <XAxis type="number" tick={chartAxisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis
                        dataKey="name"
                        type="category"
                        tick={chartAxisTickSm}
                        axisLine={false}
                        tickLine={false}
                        width={168}
                      />
                      <Tooltip content={<AnalyticsChartTooltip />} />
                      <Bar dataKey="value" fill="#dc2626" radius={[0, 6, 6, 0]} maxBarSize={22} name="Errors" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </PanelCard>

              <PanelCard title="Severity mix" description="Stacked issue severity by period.">
                {severityMixData.length === 0 ? (
                  <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                    No severity data for this range.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={severityMixData} margin={chartMarginWithLegend}>
                      <CartesianGrid {...chartGrid} />
                      <XAxis dataKey="period" tick={chartAxisTickSm} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                      <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} width={40} allowDecimals={false} />
                      <Tooltip content={<AnalyticsChartTooltip />} />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
                      <Bar dataKey="CRITICAL" stackId="1" fill="#dc2626" radius={[0, 0, 0, 0]} name="Critical" />
                      <Bar dataKey="HIGH" stackId="1" fill="#ea580c" name="High" />
                      <Bar dataKey="MEDIUM" stackId="1" fill="#ca8a04" name="Medium" />
                      <Bar dataKey="LOW" stackId="1" fill="#2563eb" radius={[4, 4, 0, 0]} name="Low" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </PanelCard>
            </div>
          </PageSection>
        </>
      ) : null}
    </PageShell>
  );
}
