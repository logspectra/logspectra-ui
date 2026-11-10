/** Start of local calendar day (00:00:00.000). */
export function startOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** End of local calendar day (23:59:59.999). */
export function endOfLocalDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** Calendar range pick → Grafana-style day bounds with editable times afterward. */
export function dayBoundsFromCalendarRange(from: Date, to: Date): { from: Date; to: Date } {
  return {
    from: startOfLocalDay(from),
    to: endOfLocalDay(to),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `datetime-local` value in local timezone. */
export function toDatetimeLocalInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fromDatetimeLocalInputValue(value: string): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatRangeLabel(from: Date, to: Date): string {
  const sameDay = from.toDateString() === to.toDateString();
  const dateFmt: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: from.getFullYear() !== to.getFullYear() ? "numeric" : undefined,
  };
  const timeFmt: Intl.DateTimeFormatOptions = { hour: "2-digit", minute: "2-digit" };
  if (sameDay) {
    return `${from.toLocaleDateString(undefined, dateFmt)} ${from.toLocaleTimeString(undefined, timeFmt)} – ${to.toLocaleTimeString(undefined, timeFmt)}`;
  }
  return `${from.toLocaleString(undefined, { ...dateFmt, ...timeFmt })} – ${to.toLocaleString(undefined, { ...dateFmt, ...timeFmt })}`;
}

/** Default custom window: today 00:00 → today 23:59:59. */
export function defaultCustomDayRange(): { from: Date; to: Date } {
  const now = new Date();
  return dayBoundsFromCalendarRange(now, now);
}
