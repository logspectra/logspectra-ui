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
        "group relative gap-0 overflow-hidden border-border py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/30 dark:shadow-none",
        className
      )}
    >
      <div
        className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden
      />
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
          <p className="mt-2.5 text-3xl font-semibold tabular-nums tracking-tight text-foreground">{value}</p>
          {hint ? <div className="mt-2 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
    </Card>
  );
}
