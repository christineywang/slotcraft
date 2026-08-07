/** Week helpers — Monday-start local weeks for the calendar grid. */

export function startOfWeek(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

export function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatWeekLabel(weekStart: Date) {
  const end = addDays(weekStart, 6);
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const year = end.getFullYear();
  return `${weekStart.toLocaleDateString("en-US", opts)} – ${end.toLocaleDateString("en-US", opts)}, ${year}`;
}

export function formatHour(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric" });
}

export function formatTime(date: Date) {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export const DAY_START_HOUR = 8;
export const DAY_END_HOUR = 20;
export const HOUR_HEIGHT = 56;
export const SNAP_MINUTES = 15;

export function hourToOffset(date: Date) {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - DAY_START_HOUR) * HOUR_HEIGHT;
}

export function durationHeight(startsAt: Date, endsAt: Date) {
  const hours = (endsAt.getTime() - startsAt.getTime()) / (60 * 60 * 1000);
  return Math.max(hours * HOUR_HEIGHT, 28);
}

export function offsetToHours(offsetPx: number) {
  return DAY_START_HOUR + offsetPx / HOUR_HEIGHT;
}

/** Snap a pixel offset within the day grid to the nearest snap interval. */
export function snapOffset(offsetPx: number, snapMinutes = SNAP_MINUTES) {
  const snapHours = snapMinutes / 60;
  const hours = offsetToHours(offsetPx);
  const snapped = Math.round(hours / snapHours) * snapHours;
  return (snapped - DAY_START_HOUR) * HOUR_HEIGHT;
}

export function dateFromDayAndOffset(day: Date, offsetPx: number) {
  const hours = offsetToHours(offsetPx);
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  const d = new Date(day);
  d.setHours(whole, minutes, 0, 0);
  return d;
}

/** Keep a booking of `durationMs` inside [openFrom, openTo) on the day grid. */
export function clampBookingOffset(
  offsetPx: number,
  durationMs: number,
  openFromHour: number,
  openToHour: number,
) {
  const durationHours = durationMs / (60 * 60 * 1000);
  const minTop = (openFromHour - DAY_START_HOUR) * HOUR_HEIGHT;
  const maxTop = (openToHour - durationHours - DAY_START_HOUR) * HOUR_HEIGHT;
  if (maxTop < minTop) return minTop;
  return Math.min(Math.max(offsetPx, minTop), maxTop);
}
