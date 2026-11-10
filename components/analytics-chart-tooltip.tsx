"use client";

type TooltipPayloadEntry = {
  name?: string;
  value?: number;
  color?: string;
  payload?: { period?: string };
};

type AnalyticsChartTooltipProps = {
  active?: boolean;
  label?: string | number;
  payload?: TooltipPayloadEntry[];
};

export function AnalyticsChartTooltip({ active, label, payload }: AnalyticsChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const header =
    payload[0]?.payload?.period ?? (typeof label === "string" ? label : undefined);

  return (
    <div className="min-w-[140px] rounded-lg border border-border bg-popover px-3 py-2.5 shadow-md">
      {header ? (
        <p className="mb-1.5 border-b border-border/60 pb-1.5 text-xs font-medium text-foreground">
          {header}
        </p>
      ) : null}
      <ul className="space-y-1">
        {payload.map((entry, index) => (
          <li key={`${entry.name}-${index}`} className="flex items-center justify-between gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span
                className="inline-block h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {typeof entry.value === "number" ? entry.value.toLocaleString() : entry.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
