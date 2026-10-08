"use client";

import { useCallback, useMemo, useState, type ComponentType } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ResolvedDateWindow } from "@/lib/date-window";
import type { TimeSeriesPoint } from "@/lib/types";

type ChartPoint = TimeSeriesPoint & { _epochMs: number };

function attachEpochMs(data: TimeSeriesPoint[], window: ResolvedDateWindow): ChartPoint[] {
  if (data.length === 0) return [];
  const span = Math.max(1, window.toMs - window.fromMs);
  return data.map((point, index) => ({
    ...point,
    _epochMs:
      window.fromMs +
      (data.length <= 1 ? 0 : (index / (data.length - 1)) * span),
  }));
}

function epochFromChartIndex(
  data: ChartPoint[],
  index: number,
  window: ResolvedDateWindow
): number {
  if (index < 0 || index >= data.length) {
    return window.fromMs;
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
  const chartData = useMemo(
    () => (dateWindow ? attachEpochMs(data, dateWindow) : []),
    [data, dateWindow]
  );

  const [brushLeftIndex, setBrushLeftIndex] = useState<number | null>(null);
  const [brushRightIndex, setBrushRightIndex] = useState<number | null>(null);
  const [isBrushing, setIsBrushing] = useState(false);

  const clearBrush = useCallback(() => {
    setBrushLeftIndex(null);
    setBrushRightIndex(null);
    setIsBrushing(false);
  }, []);

  const onMouseDown = (state: { activeTooltipIndex?: number }) => {
    if (state?.activeTooltipIndex == null || !dateWindow) return;
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
    const fromMs = epochFromChartIndex(chartData, left, dateWindow);
    const toMs = epochFromChartIndex(chartData, right, dateWindow);
    if (toMs > fromMs) {
      onBrushRange(new Date(fromMs), new Date(toMs));
    }
    clearBrush();
  };

  const refLeft =
    brushLeftIndex != null && brushRightIndex != null
      ? chartData[Math.min(brushLeftIndex, brushRightIndex)]?.timestamp
      : undefined;
  const refRight =
    brushLeftIndex != null && brushRightIndex != null
      ? chartData[Math.max(brushLeftIndex, brushRightIndex)]?.timestamp
      : undefined;

  const TooltipContent = customTooltip;

  return (
    <div>
      <p className="text-xs text-muted-foreground mb-2">
        Drag across the chart to zoom the dashboard time range (Grafana-style).
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={chartData}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={() => {
            if (isBrushing) clearBrush();
          }}
          style={{ cursor: "crosshair" }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="timestamp" tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} />
          <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} axisLine={false} />
          <Tooltip content={<TooltipContent />} />
          <Legend />
          <ReferenceLine y={300} stroke="#dc2626" strokeDasharray="5 5" label="Alert Threshold" />
          {refLeft && refRight && refLeft !== refRight ? (
            <ReferenceArea x1={refLeft} x2={refRight} strokeOpacity={0.2} fill="#3b82f6" fillOpacity={0.25} />
          ) : null}
          {serviceKeys.map((service, index) => (
            <Area
              key={service}
              type="monotone"
              dataKey={service}
              stackId="1"
              stroke={getServiceColor(service, index)}
              fill={getServiceColor(service, index)}
              fillOpacity={0.6}
              isAnimationActive={false}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
