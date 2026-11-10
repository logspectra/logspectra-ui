"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Clock } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useProject } from "@/lib/project-context";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useLiveStreamPreference } from "@/lib/live-stream-context";
import { TIME_RANGE_OPTIONS, type TimeRange } from "@/lib/time-range";
import { CustomTimeRangePicker } from "@/components/custom-time-range-picker";
import { defaultCustomDayRange } from "@/lib/datetime-range";

export function Header() {
  const pathname = usePathname();
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const { timeRange, setTimeRange, setCustomDateRange } = useProject();
  const { sseEnabled, setSseEnabled } = useLiveStreamPreference();
  const showSseToggle = pathname !== "/live";

  const handleTimeRangeChange = async (value: TimeRange) => {
    await setTimeRange(value);

    if (value === "custom") {
      const defaults = defaultCustomDayRange();
      await setCustomDateRange(defaults);
      setIsCustomDateOpen(true);
    } else {
      setIsCustomDateOpen(false);
    }
  };

  return (
    <header className="fixed left-60 right-0 top-0 z-40 flex h-16 items-center justify-between border-b border-border bg-background/75 px-6 backdrop-blur-xl">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card pl-3 pr-1 shadow-xs">
          <Clock className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
          <span className="text-xs font-medium text-muted-foreground">Range</span>
          <Select value={timeRange} onValueChange={(value) => void handleTimeRangeChange(value as TimeRange)}>
            <SelectTrigger className="h-7 w-[10.5rem] border-0 bg-transparent px-2 text-[13px] font-medium shadow-none focus:ring-0 dark:bg-transparent">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent>
              {TIME_RANGE_OPTIONS.map((tr) => (
                <SelectItem key={tr.value} value={tr.value}>
                  {tr.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {timeRange === "custom" && (
            <CustomTimeRangePicker open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        {showSseToggle && (
          <div className="flex h-9 items-center gap-2 rounded-lg border border-border bg-card px-3 shadow-xs">
            <Switch
              id="header-sse-toggle"
              checked={sseEnabled}
              onCheckedChange={setSseEnabled}
              aria-label="Toggle live log updates"
            />
            <Label htmlFor="header-sse-toggle" className="cursor-pointer text-xs font-medium text-muted-foreground">
              Live updates
            </Label>
            <span
              className={sseEnabled ? "h-1.5 w-1.5 rounded-full bg-success animate-pulse" : "h-1.5 w-1.5 rounded-full bg-muted-foreground/40"}
              aria-hidden
            />
          </div>
        )}
        <div className="h-6 w-px bg-border" aria-hidden />
        <ThemeToggle />
      </div>
    </header>
  );
}
