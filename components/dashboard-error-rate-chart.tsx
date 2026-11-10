"use client";

import { useCallback, useEffect, useMemo, useState, type ComponentType, type MouseEvent as ReactMouseEvent } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AnalyticsChartTooltip } from "@/components/analytics-chart-tooltip";
import type { ResolvedDateWindow } from "@/lib/date-window";
import type { TimeSeriesPoint } from "@/lib/types";
import {
  chartAxisTick,
  chartGrid,
  chartLegendStyle,
  chartMarginWithLegend,
} from "@/lib/recharts-theme";

type ChartPoint = TimeSeriesPoint & { _epochMs: number };

function attachEpochMs(data: TimeSeriesPoint[]): ChartPoint[] {
  return data.map((point, index) => {
    const sortKey = point._sortKey;
    const parsed =
      typeof sortKey === "string" ? new Date(sortKey).getTime() : Number.NaN;
    const epochMs = !Number.isNaN(parsed) ? parsed : index;
    return { ...point, _epochMs: epochMs };
  });
}

function formatEpochTick(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function epochFromChartIndex(data: ChartPoint[], index: number): number {
  if (index < 0 || index >= data.length) {
    return Date.now();
  }
  return data[index]._epochMs;
}

export function DashboardErrorRateChart({
  data,
  dateWindow,
  serviceKeys,
  getServiceColor,
  onBrushRange,
  customTooltip,
}: {
  data: TimeSeriesPoint[];
  dateWindow: ResolvedDateWindow | null;
  serviceKeys: string[];
  getServiceColor: (service: string, index: number) => string;
  onBrushRange: (from: Date, to: Date) => void;
  customTooltip: ComponentType<any>;
}) {
  const chartData = useMemo(() => attachEpochMs(data), [data]);

  const [brushLeftIndex, setBrushLeftIndex] = useState<number | null>(null);
  const [brushRightIndex, setBrushRightIndex] = useState<number | null>(null);
  const [isBrushing, setIsBrushing] = useState(false);

  const clearBrush = useCallback(() => {
    setBrushLeftIndex(null);
    setBrushRightIndex(null);
    setIsBrushing(false);
  }, []);

  useEffect(() => {
    if (!isBrushing) return;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    return () => {
      document.body.style.userSelect = previousUserSelect;
    };
  }, [isBrushing]);

  const onMouseDown = (
    state: { activeTooltipIndex?: number },
    event?: ReactMouseEvent<SVGElement>
  ) => {
    if (state?.activeTooltipIndex == null || !dateWindow) return;
    event?.preventDefault();
    setBrushLeftIndex(state.activeTooltipIndex);
    setBrushRightIndex(state.activeTooltipIndex);
    setIsBrushing(true);
  };

  const onMouseMove = (state: { activeTooltipIndex?: number }) => {
    if (!isBrushing || state?.activeTooltipIndex == null) return;
    setBrushRightIndex(state.activeTooltipIndex);
  };

  const onMouseUp = () => {
    if (!isBrushing || brushLeftIndex == null || brushRightIndex == null || !dateWindow) {
      clearBrush();
      return;
    }
    const left = Math.min(brushLeftIndex, brushRightIndex);
    const right = Math.max(brushLeftIndex, brushRightIndex);
    if (right - left < 1) {
      clearBrush();
      return;
    }
    const fromMs = epochFromChartIndex(chartData, left);
    const toMs = epochFromChartIndex(chartData, right);
    if (toMs > fromMs) {
      onBrushRange(new Date(fromMs), new Date(toMs));
    }
    clearBrush();
  };

  const refLeft =
    brushLeftIndex != null && brushRightIndex != null
      ? chartData[Math.min(brushLeftIndex, brushRightIndex)]?._epochMs
      : undefined;
  const refRight =
    brushLeftIndex != null && brushRightIndex != null
      ? chartData[Math.max(brushLeftIndex, brushRightIndex)]?._epochMs
      : undefined;

  const TooltipContent = customTooltip;

  const maxY = useMemo(() => {
    let max = 0;
    for (const point of chartData) {
      for (const key of serviceKeys) {
        const v = point[key];
        if (typeof v === "number" && v > max) max = v;
      }
    }
    return max;
  }, [chartData, serviceKeys]);

  const xDomain = useMemo((): [number, number] => {
    if (chartData.length === 0) return [0, 1];
    const min = chartData[0]._epochMs;
    const max = chartData[chartData.length - 1]._epochMs;
    return [min, max];
  }, [chartData]);

  if (chartData.length === 0 || serviceKeys.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 text-sm text-muted-foreground">
        No error metrics in this time range.
      </div>
    );
  }

  return (
    <div>
      <div
        className="select-none touch-none"
        onMouseDownCapture={(e) => {
          if (e.button === 0) e.preventDefault();
        }}
      >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={chartData}
            margin={chartMarginWithLegend}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={() => {
              if (isBrushing) clearBrush();
            }}
            style={{ cursor: "crosshair", userSelect: "none" }}
          >
            <CartesianGrid {...chartGrid} />
            <XAxis
              type="number"
              dataKey="_epochMs"
              domain={xDomain}
              scale="time"
              tick={chartAxisTick}
              tickFormatter={formatEpochTick}
              axisLine={false}
              tickLine={false}
            />
          <YAxis tick={chartAxisTick} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
          <Tooltip content={<TooltipContent />} labelFormatter={(ms) => formatEpochTick(Number(ms))} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={chartLegendStyle} />
          {maxY > 0 && maxY < 250 ? (
            <ReferenceLine
              y={Math.max(10, Math.round(maxY * 1.5))}
              stroke="#dc2626"
              strokeDasharray="5 5"
              label="Alert threshold"
            />
          ) : null}
          {refLeft != null && refRight != null && refLeft !== refRight ? (
            <ReferenceArea x1={refLeft} x2={refRight} strokeOpacity={0.2} fill="#3b82f6" fillOpacity={0.25} />
          ) : null}
          {serviceKeys.map((service, index) => (
            <Line
              key={service}
              type="monotone"
              dataKey={service}
              stroke={getServiceColor(service, index)}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
