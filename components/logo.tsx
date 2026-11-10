import { cn } from "@/lib/utils";

/** Bar-chart mark used on the public LogSpectra site. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("text-primary", className)} aria-hidden>
      <rect x="2" y="14" width="3" height="6" rx="1" fill="currentColor" opacity="0.6" />
      <rect x="7" y="10" width="3" height="10" rx="1" fill="currentColor" opacity="0.8" />
      <rect x="12" y="4" width="3" height="16" rx="1" fill="currentColor" />
      <rect x="17" y="8" width="3" height="12" rx="1" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("flex items-center gap-2", className)}>
      <LogoMark className="h-6 w-6" />
      <span className="text-[15px] font-semibold tracking-tight text-foreground">LogSpectra</span>
    </span>
  );
}
