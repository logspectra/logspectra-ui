"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProject } from "@/lib/project-context";
import {
  dayBoundsFromCalendarRange,
  defaultCustomDayRange,
  formatRangeLabel,
  fromDatetimeLocalInputValue,
  toDatetimeLocalInputValue,
} from "@/lib/datetime-range";

export function CustomTimeRangePicker({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { customDateRange, applyCustomWindow } = useProject();
  const [fromInput, setFromInput] = useState("");
  const [toInput, setToInput] = useState("");
  const [calendarRange, setCalendarRange] = useState<DateRange>({});

  useEffect(() => {
    if (!open) return;
    const from = customDateRange.from ?? defaultCustomDayRange().from;
    const to = customDateRange.to ?? defaultCustomDayRange().to;
    setFromInput(toDatetimeLocalInputValue(from));
    setToInput(toDatetimeLocalInputValue(to));
    setCalendarRange({ from, to });
  }, [open, customDateRange.from?.getTime(), customDateRange.to?.getTime()]);

  const triggerLabel =
    customDateRange.from && customDateRange.to
      ? formatRangeLabel(customDateRange.from, customDateRange.to)
      : "Set custom range";

  const apply = async () => {
    const from = fromDatetimeLocalInputValue(fromInput);
    const to = fromDatetimeLocalInputValue(toInput);
    if (!from || !to || from.getTime() >= to.getTime()) return;
    await applyCustomWindow(from, to);
    onOpenChange(false);
  };

  const onCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      setCalendarRange(range || {});
      return;
    }
    const toDate = range.to ?? range.from;
    const bounds = dayBoundsFromCalendarRange(range.from, toDate);
    setCalendarRange({ from: bounds.from, to: bounds.to });
    setFromInput(toDatetimeLocalInputValue(bounds.from));
    setToInput(toDatetimeLocalInputValue(bounds.to));
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="min-w-[280px] max-w-[420px] justify-start text-left font-normal">
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          <span className="truncate">{triggerLabel}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-4" align="start">
        <div className="space-y-4">
          <Calendar mode="range" selected={calendarRange} onSelect={onCalendarSelect} numberOfMonths={2} />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="range-from" className="text-xs text-muted-foreground">From</Label>
              <Input
                id="range-from"
                type="datetime-local"
                step={1}
                value={fromInput}
                onChange={(e) => setFromInput(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="range-to" className="text-xs text-muted-foreground">To</Label>
              <Input
                id="range-to"
                type="datetime-local"
                step={1}
                value={toInput}
                onChange={(e) => setToInput(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Calendar picks use 00:00:00 on the start day and 23:59:59 on the end day. Adjust times above, then Apply.
          </p>
          <Button className="w-full" onClick={() => void apply()}>
            Apply time range
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
