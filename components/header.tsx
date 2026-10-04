"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const TIME_RANGES = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "custom", label: "Custom" },
] as const;

export function Header() {
  const pathname = usePathname();
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const { timeRange, setTimeRange, customDateRange, setCustomDateRange } = useProject();
  const { sseEnabled, setSseEnabled } = useLiveStreamPreference();
  const showSseToggle = pathname !== "/live";

  const calendarRange: DateRange = {
    from: customDateRange.from,
    to: customDateRange.to,
  };

  const formatDateRangeLabel = (range: { from?: Date; to?: Date }): string => {
    if (range.from && range.to) {
      return `${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`;
    }
    if (range.from) {
      return `${range.from.toLocaleDateString()} - ...`;
    }
    return "Select date range";
  };

  const handleTimeRangeChange = async (value: (typeof TIME_RANGES)[number]["value"]) => {
    await setTimeRange(value);

    if (value === "custom") {
      setIsCustomDateOpen(true);
    } else {
      setIsCustomDateOpen(false);
    }
  };

  return (
    <header className="fixed top-0 left-60 right-0 h-16 border-b border-border bg-card px-6 flex items-center justify-between z-40">
      {/* Left: Time Range */}
      <div className="flex items-center gap-4">
        {/* Environment dropdown hidden for now */}

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Time Range:</span>
          <Select value={timeRange} onValueChange={(value) => void handleTimeRangeChange(value as (typeof TIME_RANGES)[number]["value"])}>
            <SelectTrigger className="w-32 bg-input border-border text-foreground">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border">
              {TIME_RANGES.map((tr) => (
                <SelectItem key={tr.value} value={tr.value}>
                  {tr.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {timeRange === "custom" && (
            <Popover open={isCustomDateOpen} onOpenChange={setIsCustomDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-[250px] justify-start text-left font-normal"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formatDateRangeLabel(calendarRange)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={calendarRange}
                  onSelect={(range) => {
                    void setCustomDateRange(range || {});
                    if (range?.from && range?.to) {
                      void setTimeRange("custom");
                    }
                  }}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Right: optional SSE toggle (not on dedicated Live page) + theme */}
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
