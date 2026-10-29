/** Shared Recharts styling for dashboard + analytics (works on light cards). */

export const chartMargin = {
  top: 12,
  right: 16,
  left: 4,
  bottom: 4,
} as const;

export const chartMarginWithLegend = {
  ...chartMargin,
  bottom: 8,
} as const;

export const chartGrid = {
  strokeDasharray: "3 3",
  stroke: "#e4e4e7",
  vertical: false,
} as const;

export const chartAxisTick = {
  fill: "#71717a",
  fontSize: 11,
} as const;

export const chartAxisTickSm = {
  ...chartAxisTick,
  fontSize: 10,
} as const;

export const chartLegendStyle = {
  paddingTop: 12,
  fontSize: 12,
} as const;
