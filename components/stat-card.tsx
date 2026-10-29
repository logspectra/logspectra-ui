import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatCardProps = {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

export function StatCard({ label, value, hint, aside, className }: StatCardProps) {
  return (
    <Card
      className={cn(
        "gap-0 border-border/80 py-0 shadow-sm transition-shadow hover:shadow-md",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </Card>
  );
}
