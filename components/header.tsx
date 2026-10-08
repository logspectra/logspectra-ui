"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
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
    <header className="fixed top-0 left-60 right-0 min-h-16 border-b border-border bg-card px-6 py-2 flex items-center justify-between z-40">
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Time Range:</span>
          <Select value={timeRange} onValueChange={(value) => void handleTimeRangeChange(value as TimeRange)}>
            <SelectTrigger className="w-[11.5rem] bg-input border-border text-foreground">
              <SelectValue placeholder="Select range" />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
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

      <div className="flex items-center gap-4">
        {showSseToggle && (
          <div className="flex items-center gap-2">
            <Switch
              id="header-sse-toggle"
              checked={sseEnabled}
              onCheckedChange={setSseEnabled}
              aria-label="Toggle live log updates"
            />
            <Label htmlFor="header-sse-toggle" className="text-sm text-muted-foreground cursor-pointer">
              Live updates
            </Label>
          </div>
        )}
        <ThemeToggle />
      </div>
    </header>
  );
}
