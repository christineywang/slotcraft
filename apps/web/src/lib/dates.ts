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

export function hourToOffset(date: Date) {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - DAY_START_HOUR) * HOUR_HEIGHT;
}

export function durationHeight(startsAt: Date, endsAt: Date) {
  const hours = (endsAt.getTime() - startsAt.getTime()) / (60 * 60 * 1000);
  return Math.max(hours * HOUR_HEIGHT, 28);
}

/** Minutes of granularity when dragging booking blocks on the week grid. */
export const DRAG_SNAP_MINUTES = 15;

/**
 * Convert a Y offset within the day column into a Date on `day`,
 * snapped to DRAG_SNAP_MINUTES within the visible day range.
 */
export function offsetToSnappedTime(day: Date, offsetY: number) {
  const rawHours = DAY_START_HOUR + offsetY / HOUR_HEIGHT;
  const totalMinutes = Math.round((rawHours * 60) / DRAG_SNAP_MINUTES) * DRAG_SNAP_MINUTES;
  const clamped = Math.min(
    Math.max(totalMinutes, DAY_START_HOUR * 60),
    DAY_END_HOUR * 60 - DRAG_SNAP_MINUTES,
  );
  const next = new Date(day);
  next.setHours(0, 0, 0, 0);
  next.setMinutes(clamped);
  return next;
}

export function bookingDurationMs(startsAt: Date, endsAt: Date) {
  return Math.max(endsAt.getTime() - startsAt.getTime(), DRAG_SNAP_MINUTES * 60 * 1000);
}
