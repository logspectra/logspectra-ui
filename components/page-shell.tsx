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
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        {(Icon || eyebrow) && (
          <div className="mb-1 flex items-center gap-2 text-primary">
            {Icon ? <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden /> : null}
            {eyebrow ? (
              <span className="text-xs font-semibold uppercase tracking-wider">{eyebrow}</span>
            ) : null}
          </div>
        )}
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function PageSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="space-y-4">
      {title ? <h2 className="text-sm font-medium text-muted-foreground">{title}</h2> : null}
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
    <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
      <span
        className={cn(
          "h-2 w-2 rounded-full",
          isLive && "bg-emerald-500 animate-pulse",
          !isLive && !isIdle && "bg-amber-500 animate-pulse",
          isIdle && "bg-zinc-400"
        )}
      />
      <span>{label}</span>
    </div>
  );
}
