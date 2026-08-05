/** Helpers for multi-seat resource capacity display on the calendar. */

export type Timed = {
  startsAt: string;
  endsAt: string;
};

export function intervalsOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
) {
  return aStart < bEnd && aEnd > bStart;
}

/** How many bookings in `all` overlap the given interval (including itself). */
export function countOverlapping(target: Timed, all: Timed[]): number {
  const start = new Date(target.startsAt).getTime();
  const end = new Date(target.endsAt).getTime();
  return all.filter((b) =>
    intervalsOverlap(
      start,
      end,
      new Date(b.startsAt).getTime(),
      new Date(b.endsAt).getTime(),
    ),
  ).length;
}

/**
 * For capacity > 1, reserve a column per seat so empty capacity stays visible
 * after switching to a multi-seat desk.
 */
export function capacityColumnCount(
  overlappingColumnCount: number,
  capacity: number,
) {
  if (capacity > 1) {
    return Math.max(overlappingColumnCount, capacity);
  }
  return Math.max(overlappingColumnCount, 1);
}
