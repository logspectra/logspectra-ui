"use client";

import Link from "next/link";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import type { ErrorTriagePoint } from "@/lib/types";
import {
  chartAxisTick,
  chartGrid,
  chartLegendStyle,
  chartMarginWithLegend,
} from "@/lib/recharts-theme";
import { AnalyticsChartTooltip } from "@/components/analytics-chart-tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function triageTotals(data: ErrorTriagePoint[]) {
  let open = 0;
  let resolved = 0;
  for (const row of data) {
    open += row.open;
    resolved += row.resolved;
  }
  const total = open + resolved;
  const resolvedPct = total > 0 ? Math.round((resolved / total) * 100) : 0;
  return { open, resolved, total, resolvedPct };
}

function StatPill({
  label,
  value,
  tone,
  suffix = "",
}: {
  label: string;
  value: number;
  tone: "open" | "resolved" | "neutral";
  suffix?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col gap-0.5 rounded-lg border px-3 py-2",
        tone === "open" && "border-red-200/80 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30",
        tone === "resolved" &&
          "border-emerald-200/80 bg-emerald-50/80 dark:border-emerald-900/50 dark:bg-emerald-950/30",
        tone === "neutral" && "border-border/80 bg-muted/40"
      )}
    >
      <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-lg font-semibold tabular-nums tracking-tight text-foreground">
        {value.toLocaleString()}
        {suffix}
      </span>
    </div>
  );
}

export function AnalyticsErrorTriageChart({ data }: { data: ErrorTriagePoint[] }) {
  const chartData = data.map((row, index) => ({
    ...row,
    periodKey: row.periodKey || `${row.period}-${index}`,
  }));

  const { open, resolved, total, resolvedPct } = triageTotals(chartData);

  if (chartData.length === 0 || total === 0) {
    return (
      <div className="flex min-h-[280px] flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
        <CircleAlert className="h-9 w-9 text-muted-foreground/70" strokeWidth={1.5} />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">No errors in this range</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            When ERROR logs appear, open vs resolved counts show here. Mark logs resolved in Explorer to
            track triage progress.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link href="/explorer">
            Open Explorer
            <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <StatPill label="Open" value={open} tone="open" />
        <StatPill label="Resolved" value={resolved} tone="resolved" />
        <StatPill label="Resolved rate" value={resolvedPct} tone="neutral" suffix="%" />
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={chartData} margin={chartMarginWithLegend}>
          <defs>
            <linearGradient id="triageOpenFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#ef4444" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="triageResolvedFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
              <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid {...chartGrid} />
          <XAxis
            dataKey="periodKey"
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
            tickFormatter={(_, index) => chartData[index]?.period ?? ""}
          />
          <YAxis
            tick={chartAxisTick}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            width={36}
          />
          <Tooltip content={<AnalyticsChartTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={chartLegendStyle}
          />
          <Area
            type="monotone"
            dataKey="open"
            stackId="1"
            stroke="#dc2626"
            strokeWidth={2}
            fill="url(#triageOpenFill)"
            name="Open"
            isAnimationActive={false}
          />
          <Area
            type="monotone"
            dataKey="resolved"
            stackId="1"
            stroke="#16a34a"
            strokeWidth={2}
            fill="url(#triageResolvedFill)"
            name="Resolved"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
