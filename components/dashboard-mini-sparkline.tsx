"use client";

import { memo, useMemo } from "react";
import { Line, LineChart } from "recharts";

type DashboardMiniSparklineProps = {
  data: number[];
  color: string;
};

function DashboardMiniSparklineComponent({ data, color }: DashboardMiniSparklineProps) {
  const chartData = useMemo(
    () => data.map((value, index) => ({ value, index })),
    [data]
  );

  if (chartData.length === 0) {
    return <div className="h-6 w-[60px]" aria-hidden />;
  }

  return (
    <LineChart width={60} height={24} data={chartData}>
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={2}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}

export const DashboardMiniSparkline = memo(DashboardMiniSparklineComponent);
