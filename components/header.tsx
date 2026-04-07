"use client";

import { useState } from "react";
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

const TIME_RANGES = [
  { value: "1h", label: "1h" },
  { value: "6h", label: "6h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
  { value: "30d", label: "30d" },
  { value: "custom", label: "Custom" },
] as const;

export function Header() {
  const [isCustomDateOpen, setIsCustomDateOpen] = useState(false);
  const { timeRange, setTimeRange, customDateRange, setCustomDateRange } = useProject();

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
                  onSelect={(range) => void setCustomDateRange(range || {})}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Right: Live Status and Theme Toggle */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-muted-foreground">Live</span>
        </div>
        <ThemeToggle />
      </div>
    </header>
  );
}
