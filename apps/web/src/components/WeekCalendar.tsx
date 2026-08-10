"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { Booking, Resource } from "@slotcraft/shared";
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
  canDragBooking?: (booking: Booking) => boolean;
  movingId?: string | null;
  onSlotClick: (start: Date) => void;
  onBookingClick: (booking: Booking) => void;
  onBookingMove?: (
    booking: Booking,
    startsAt: Date,
    endsAt: Date,
  ) => void | Promise<void>;
};

const hours = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
);
const days = Array.from({ length: 7 }, (_, i) => i);
const SNAP_MINUTES = 15;
const DRAG_THRESHOLD_PX = 6;

type DragState = {
  booking: Booking;
  durationMs: number;
  pointerId: number;
  originX: number;
  originY: number;
  grabbed: boolean;
  dayOffset: number;
  startMinutes: number;
};

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

  const columnCount = Math.max(columnEnds.length, 1);
  return { placed, columnCount };
}

function minutesFromMidnight(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function clampDragWindow(
  startMinutes: number,
  durationMinutes: number,
  openFrom: number,
  openTo: number,
) {
  const openFromMin = openFrom * 60;
  const openToMin = openTo * 60;
  const dayStartMin = DAY_START_HOUR * 60;
  const dayEndMin = DAY_END_HOUR * 60;
  const minStart = Math.max(openFromMin, dayStartMin);
  const maxEnd = Math.min(openToMin, dayEndMin);
  const maxStart = Math.max(minStart, maxEnd - durationMinutes);
  const snapped = Math.round(startMinutes / SNAP_MINUTES) * SNAP_MINUTES;
  return Math.min(Math.max(snapped, minStart), maxStart);
}

function dateAtDayMinutes(day: Date, minutes: number) {
  const d = new Date(day);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

export function WeekCalendar({
  weekStart,
  bookings,
  resource,
  highlightId,
  freshIds,
  canDragBooking,
  movingId,
  onSlotClick,
  onBookingClick,
  onBookingMove,
}: Props) {
  const totalHeight = hours.length * HOUR_HEIGHT;
  const openFrom = resource.availableFromHour;
  const openTo = resource.availableToHour;
  const dayColumnRefs = useRef<Array<HTMLDivElement | null>>([]);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  const resolveDayOffset = useCallback((clientX: number) => {
    for (let i = 0; i < dayColumnRefs.current.length; i++) {
      const el = dayColumnRefs.current[i];
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      if (clientX >= rect.left && clientX < rect.right) return i;
    }
    const first = dayColumnRefs.current[0]?.getBoundingClientRect();
    const last = dayColumnRefs.current[6]?.getBoundingClientRect();
    if (!first || !last) return 0;
    if (clientX < first.left) return 0;
    if (clientX >= last.right) return 6;
    return 0;
  }, []);

  const resolveStartMinutes = useCallback(
    (clientY: number, dayOffset: number, durationMinutes: number) => {
      const el = dayColumnRefs.current[dayOffset];
      if (!el) return DAY_START_HOUR * 60;
      const rect = el.getBoundingClientRect();
      const y = clientY - rect.top;
      const rawMinutes = DAY_START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;
      return clampDragWindow(rawMinutes, durationMinutes, openFrom, openTo);
    },
    [openFrom, openTo],
  );

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      const dx = e.clientX - current.originX;
      const dy = e.clientY - current.originY;
      const grabbed =
        current.grabbed ||
        Math.hypot(dx, dy) >= DRAG_THRESHOLD_PX;

      const durationMinutes = current.durationMs / (60 * 1000);
      const dayOffset = resolveDayOffset(e.clientX);
      const startMinutes = resolveStartMinutes(
        e.clientY,
        dayOffset,
        durationMinutes,
      );

      const next: DragState = {
        ...current,
        grabbed,
        dayOffset,
        startMinutes,
      };
      dragRef.current = next;
      setDrag(next);
    }

    async function onPointerUp(e: PointerEvent) {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;

      if (!current.grabbed) {
        dragRef.current = null;
        setDrag(null);
        onBookingClick(current.booking);
        return;
      }

      if (!onBookingMove) {
        dragRef.current = null;
        setDrag(null);
        return;
      }

      const day = addDays(weekStart, current.dayOffset);
      const startsAt = dateAtDayMinutes(day, current.startMinutes);
      const endsAt = new Date(startsAt.getTime() + current.durationMs);
      const originalStart = new Date(current.booking.startsAt).getTime();
      const originalEnd = new Date(current.booking.endsAt).getTime();
      if (
        startsAt.getTime() === originalStart &&
        endsAt.getTime() === originalEnd
      ) {
        dragRef.current = null;
        setDrag(null);
        return;
      }

      // Start the move (optimistic update) before clearing drag so React
      // batches both and the block does not flash at the old position.
      const movePromise = onBookingMove(current.booking, startsAt, endsAt);
      dragRef.current = null;
      setDrag(null);
      await movePromise;
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [
    onBookingClick,
    onBookingMove,
    resolveDayOffset,
    resolveStartMinutes,
    weekStart,
  ]);

  function beginDrag(
    booking: Booking,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (e.button !== 0) return;
    if (movingId) return;
    if (!canDragBooking?.(booking) || !onBookingMove) {
      return;
    }

    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);

    const start = new Date(booking.startsAt);
    const end = new Date(booking.endsAt);
    const dayOffset = days.find((offset) =>
      sameDay(addDays(weekStart, offset), start),
    ) ?? 0;
    const next: DragState = {
      booking,
      durationMs: end.getTime() - start.getTime(),
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      grabbed: false,
      dayOffset,
      startMinutes: minutesFromMidnight(start),
    };
    dragRef.current = next;
    setDrag(next);
  }

  const preview =
    drag?.grabbed
      ? {
          dayOffset: drag.dayOffset,
          startsAt: dateAtDayMinutes(
            addDays(weekStart, drag.dayOffset),
            drag.startMinutes,
          ),
          endsAt: new Date(
            dateAtDayMinutes(
              addDays(weekStart, drag.dayOffset),
              drag.startMinutes,
            ).getTime() + drag.durationMs,
          ),
          booking: drag.booking,
        }
      : null;

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
          const { placed, columnCount } = layoutColumns(dayBookings);
          const showPreview = preview?.dayOffset === offset;

          return (
            <div
              key={offset}
              ref={(el) => {
                dayColumnRefs.current[offset] = el;
              }}
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
                const draggable = Boolean(
                  canDragBooking?.(booking) && onBookingMove,
                );
                const isDragging =
                  drag?.grabbed && drag.booking.id === booking.id;
                const isMoving = movingId === booking.id;

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      // Click opens the panel only when we did not drag.
                      if (dragRef.current?.booking.id === booking.id) return;
                      if (!draggable) onBookingClick(booking);
                    }}
                    onPointerDown={(e) => beginDrag(booking, e)}
                    aria-grabbed={isDragging || undefined}
                    className={`absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-white transition hover:brightness-110 ${
                      highlighted
                        ? "border-coral bg-coral animate-coral-flash"
                        : "border-teal/30 bg-teal"
                    } ${fresh ? "animate-spring-in" : ""} ${
                      isDragging || isMoving ? "opacity-35" : ""
                    } ${draggable ? "cursor-grab active:cursor-grabbing touch-none" : ""}`}
                    style={{
                      top,
                      height: Math.min(height, totalHeight - top),
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                    }}
                  >
                    <div className="truncate text-xs font-semibold">
                      {booking.title}
                    </div>
                    <div className="truncate text-[10px] opacity-90">
                      {initials(booking.host.name)}
                    </div>
                  </button>
                );
              })}

              {showPreview && preview ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1 z-20 overflow-hidden rounded-md border border-dashed border-teal/50 bg-teal/25 px-2 py-1 text-left text-teal shadow-sm"
                  style={{
                    top: Math.max(hourToOffset(preview.startsAt), 0),
                    height: Math.min(
                      durationHeight(preview.startsAt, preview.endsAt),
                      totalHeight - Math.max(hourToOffset(preview.startsAt), 0),
                    ),
                  }}
                >
                  <div className="truncate text-xs font-semibold">
                    {preview.booking.title}
                  </div>
                  <div className="truncate text-[10px] opacity-90">
                    Drop to reschedule
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
