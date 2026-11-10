import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-auto max-w-[1600px] space-y-8 pb-8", className)}>{children}</div>;
}

type PageHeaderProps = {
  icon?: LucideIcon;
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({
  icon: Icon,
  eyebrow,
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex min-w-0 items-start gap-4">
        {Icon ? (
          <div className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary sm:flex">
            <Icon className="h-5 w-5" strokeWidth={1.9} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0">
          {eyebrow ? (
            <span className="mb-1.5 inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wider text-primary">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight text-foreground">{title}</h1>
          {description ? (
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      {title ? (
        <div className="flex items-center gap-3">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</h2>
          <div className="h-px flex-1 bg-gradient-to-r from-border to-transparent" aria-hidden />
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function LiveStatusPill({
  status,
}: {
  status: "live" | "connecting" | "reconnecting" | "idle" | string;
}) {
  const isLive = status === "live";
  const isIdle = status === "idle";
  const label = isLive
    ? "Live updates on"
    : status === "connecting"
      ? "Connecting…"
      : status === "reconnecting"
        ? "Reconnecting…"
        : "Live updates off";

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isLive && "bg-success animate-pulse",
          !isLive && !isIdle && "bg-warning animate-pulse",
          isIdle && "bg-muted-foreground/40"
        )}
      />
      <span>{label}</span>
    </div>
  );
}
