"use client";

import type { Booking } from "@slotcraft/shared";
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
  bookable: boolean;
  highlightId: string | null;
  freshIds: Set<string>;
  onSlotClick: (start: Date) => void;
};

const hours = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
);
const days = Array.from({ length: 7 }, (_, i) => i);

export function WeekCalendar({
  weekStart,
  bookings,
  highlightId,
  freshIds,
  onSlotClick,
}: Omit<Props, "bookable"> & { bookable?: boolean }) {
  const totalHeight = hours.length * HOUR_HEIGHT;

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

          return (
            <div
              key={offset}
              className="calendar-grid-bg relative border-l border-ink/8"
              style={{ height: totalHeight }}
            >
              {hours.map((hour) => {
                const slot = new Date(day);
                slot.setHours(hour, 0, 0, 0);
                return (
                  <button
                    key={hour}
                    type="button"
                    aria-label={`Book ${formatHour(hour)}`}
                    onClick={() => onSlotClick(slot)}
                    className="absolute inset-x-0 cursor-cell border-b border-ink/5 transition hover:bg-teal/10"
                    style={{
                      top: (hour - DAY_START_HOUR) * HOUR_HEIGHT,
                      height: HOUR_HEIGHT,
                    }}
                  />
                );
              })}

              {dayBookings.map((booking) => {
                const start = new Date(booking.startsAt);
                const end = new Date(booking.endsAt);
                const top = Math.max(hourToOffset(start), 0);
                const height = durationHeight(start, end);
                const highlighted = highlightId === booking.id;
                const fresh = freshIds.has(booking.id);

                return (
                  <div
                    key={booking.id}
                    className={`pointer-events-none absolute inset-x-1 z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-white ${
                      highlighted
                        ? "border-coral bg-coral animate-coral-flash"
                        : "border-teal/30 bg-teal"
                    } ${fresh ? "animate-spring-in" : ""}`}
                    style={{ top, height: Math.min(height, totalHeight - top) }}
                  >
                    <div className="truncate text-xs font-semibold">
                      {booking.title}
                    </div>
                    <div className="truncate text-[10px] opacity-90">
                      {initials(booking.host.name)}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
