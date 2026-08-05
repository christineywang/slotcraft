"use client";

import type { Booking, Resource } from "@slotcraft/shared";
import {
  capacityColumnCount,
  countOverlapping,
} from "@/lib/capacity";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOUR_HEIGHT,
  addDays,
  durationHeight,
  formatHour,
  hourToOffset,
  initials,
  sameDay,
} from "@/lib/dates";

type Props = {
  weekStart: Date;
  bookings: Booking[];
  resource: Resource;
  highlightId: string | null;
  freshIds: Set<string>;
  onSlotClick: (start: Date) => void;
  onBookingClick: (booking: Booking) => void;
};

const hours = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
);
const days = Array.from({ length: 7 }, (_, i) => i);

function layoutColumns(dayBookings: Booking[]) {
  const sorted = [...dayBookings].sort(
    (a, b) =>
      new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime() ||
      new Date(a.endsAt).getTime() - new Date(b.endsAt).getTime(),
  );

  const columnEnds: number[] = [];
  const placed: { booking: Booking; column: number }[] = [];

  for (const booking of sorted) {
    const start = new Date(booking.startsAt).getTime();
    const end = new Date(booking.endsAt).getTime();
    let column = columnEnds.findIndex((ends) => ends <= start);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(end);
    } else {
      columnEnds[column] = end;
    }
    placed.push({ booking, column });
  }

  return { placed, columnCount: columnEnds.length };
}

export function WeekCalendar({
  weekStart,
  bookings,
  resource,
  highlightId,
  freshIds,
  onSlotClick,
  onBookingClick,
}: Props) {
  const totalHeight = hours.length * HOUR_HEIGHT;
  const openFrom = resource.availableFromHour;
  const openTo = resource.availableToHour;

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-white/70 backdrop-blur">
      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))] border-b border-ink/10">
        <div />
        {days.map((offset) => {
          const day = addDays(weekStart, offset);
          const isToday = sameDay(day, new Date());
          return (
            <div
              key={offset}
              className={`px-2 py-3 text-center ${isToday ? "bg-teal/5" : ""}`}
            >
              <div className="text-[11px] uppercase tracking-[0.12em] text-ink/45">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </div>
              <div
                className={`font-display text-xl ${
                  isToday ? "text-teal" : "text-ink"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]">
        <div className="relative" style={{ height: totalHeight }}>
          {hours.map((hour) => (
            <div
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-ink/40"
              style={{ top: (hour - DAY_START_HOUR) * HOUR_HEIGHT }}
            >
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {days.map((offset) => {
          const day = addDays(weekStart, offset);
          const dayBookings = bookings.filter((b) =>
            sameDay(new Date(b.startsAt), day),
          );
          const { placed, columnCount: laidOut } = layoutColumns(dayBookings);
          const columnCount = capacityColumnCount(laidOut, resource.capacity);

          return (
            <div
              key={`${resource.id}-${offset}`}
              className="calendar-grid-bg relative border-l border-ink/8"
              style={{ height: totalHeight }}
            >
              {hours.map((hour) => {
                const slot = new Date(day);
                slot.setHours(hour, 0, 0, 0);
                const closed = hour < openFrom || hour >= openTo;
                return (
                  <button
                    key={hour}
                    type="button"
                    aria-label={
                      closed
                        ? `Closed ${formatHour(hour)}`
                        : `Book ${formatHour(hour)}`
                    }
                    onClick={() => onSlotClick(slot)}
                    className={`absolute inset-x-0 border-b border-ink/5 transition ${
                      closed
                        ? "cursor-not-allowed bg-ink/[0.04] hover:bg-ink/[0.06]"
                        : "cursor-cell hover:bg-teal/10"
                    }`}
                    style={{
                      top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                      height: HOUR_HEIGHT,
                    }}
                  />
                );
              })}

              {placed.map(({ booking, column }) => {
                const start = new Date(booking.startsAt);
                const end = new Date(booking.endsAt);
                const top = Math.max(hourToOffset(start), 0);
                const height = durationHeight(start, end);
                const highlighted = highlightId === booking.id;
                const fresh = freshIds.has(booking.id);
                const widthPct = 100 / columnCount;
                const leftPct = column * widthPct;
                const seatsUsed =
                  resource.capacity > 1
                    ? countOverlapping(booking, dayBookings)
                    : null;

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onBookingClick(booking);
                    }}
                    className={`absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-white transition hover:brightness-110 ${
                      highlighted
                        ? "border-coral bg-coral animate-coral-flash"
                        : "border-teal/30 bg-teal"
                    } ${fresh ? "animate-spring-in" : ""}`}
                    style={{
                      top,
                      height: Math.min(height, totalHeight - top),
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="truncate text-xs font-semibold">
                        {booking.title}
                      </div>
                      {seatsUsed != null ? (
                        <span
                          className="shrink-0 rounded bg-white/20 px-1 text-[10px] font-semibold leading-4"
                          title={`${seatsUsed} of ${resource.capacity} seats taken in this slot`}
                        >
                          {seatsUsed}/{resource.capacity}
                        </span>
                      ) : null}
                    </div>
                    <div className="truncate text-[10px] opacity-90">
                      {initials(booking.host.name)}
                    </div>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
