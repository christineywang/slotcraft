export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function formatRange(startsAt: Date, endsAt: Date) {
  const opts: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  return `${startsAt.toLocaleTimeString("en-US", opts)}–${endsAt.toLocaleTimeString("en-US", opts)}`;
}

export function formatHourLabel(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric" });
}

/** Booking interval must sit entirely inside [availableFromHour, availableToHour). */
export function isWithinAvailability(
  startsAt: Date,
  endsAt: Date,
  availableFromHour: number,
  availableToHour: number,
): boolean {
  if (startsAt.toDateString() !== endsAt.toDateString()) {
    return false;
  }
  const startHour = startsAt.getHours() + startsAt.getMinutes() / 60;
  const endHour = endsAt.getHours() + endsAt.getMinutes() / 60;
  // Midnight end (00:00 next calendar day already rejected above) — allow exact close.
  const endAsHour =
    endsAt.getHours() === 0 && endsAt.getMinutes() === 0
      ? 24
      : endHour;
  return startHour >= availableFromHour && endAsHour <= availableToHour;
}

/**
 * Capacity is full when the number of overlapping confirmed bookings
 * (optionally excluding one booking being rescheduled) is >= capacity.
 */
export function isAtCapacity(
  overlappingCount: number,
  capacity: number,
): boolean {
  return overlappingCount >= capacity;
}

export function canMutateBooking(
  role: "owner" | "admin" | "member" | "viewer",
  hostId: string,
  userId: string,
): boolean {
  if (role === "viewer") return false;
  if (role === "owner" || role === "admin") return true;
  return hostId === userId;
}
