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
/** Snap dragged bookings to this many minutes. */
export const DRAG_SNAP_MINUTES = 15;

export function hourToOffset(date: Date) {
  const hours = date.getHours() + date.getMinutes() / 60;
  return (hours - DAY_START_HOUR) * HOUR_HEIGHT;
}

export function durationHeight(startsAt: Date, endsAt: Date) {
  const hours = (endsAt.getTime() - startsAt.getTime()) / (60 * 60 * 1000);
  return Math.max(hours * HOUR_HEIGHT, 28);
}

/** Snap a fractional hour (e.g. 9.25) to the nearest DRAG_SNAP_MINUTES. */
export function snapHour(hour: number, snapMinutes = DRAG_SNAP_MINUTES) {
  const snap = snapMinutes / 60;
  return Math.round(hour / snap) * snap;
}

/**
 * Map a Y offset within the day column to a start Date on `day`,
 * snapped and clamped so a booking of `durationMs` fits in [openFrom, openTo).
 */
export function dropTimeFromOffset(
  day: Date,
  offsetY: number,
  durationMs: number,
  openFrom: number,
  openTo: number,
) {
  const durationHours = durationMs / (60 * 60 * 1000);
  const rawHour = DAY_START_HOUR + offsetY / HOUR_HEIGHT;
  let startHour = snapHour(rawHour);

  const minStart = openFrom;
  const maxStart = openTo - durationHours;
  if (maxStart < minStart) {
    startHour = minStart;
  } else {
    startHour = Math.min(Math.max(startHour, minStart), maxStart);
    startHour = snapHour(startHour);
    // Re-clamp after snap in case rounding nudged outside the window.
    startHour = Math.min(Math.max(startHour, minStart), maxStart);
  }

  const startsAt = new Date(day);
  const hours = Math.floor(startHour);
  const minutes = Math.round((startHour - hours) * 60);
  startsAt.setHours(hours, minutes, 0, 0);
  const endsAt = new Date(startsAt.getTime() + durationMs);
  return { startsAt, endsAt };
}
