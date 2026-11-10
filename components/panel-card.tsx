import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type PanelCardProps = {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  variant?: "default" | "compact";
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

export function PanelCard({
  title,
  description,
  action,
  variant = "default",
  className,
  bodyClassName,
  children,
}: PanelCardProps) {
  const compact = variant === "compact";

  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden border-border py-0 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors hover:border-primary/25 dark:shadow-none",
        className
      )}
    >
      <div
        className={cn(
          "flex items-start justify-between gap-3 border-b border-border",
          compact ? "px-4 py-2.5" : "px-5 py-4"
        )}
      >
        <div className="min-w-0 space-y-0.5">
          <h3
            className={cn(
              "font-semibold tracking-tight text-foreground",
              compact ? "text-xs" : "text-sm"
            )}
          >
            {title}
          </h3>
          {description && !compact ? (
            <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className={cn(compact ? "p-4" : "px-5 pb-5 pt-4", bodyClassName)}>{children}</div>
    </Card>
  );
}
