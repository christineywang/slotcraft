"use client";

import { useEffect, useRef, useState } from "react";
import type { Booking, Resource } from "@slotcraft/shared";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOUR_HEIGHT,
  addDays,
  bookingDurationMs,
  durationHeight,
  formatHour,
  hourToOffset,
  initials,
  offsetToSnappedTime,
  sameDay,
} from "@/lib/dates";

type Props = {
  weekStart: Date;
  bookings: Booking[];
  resource: Resource;
  highlightId: string | null;
  freshIds: Set<string>;
  /** When set, the booking may be dragged to a new slot. */
  canDragBooking?: (booking: Booking) => boolean;
  draggingId?: string | null;
  onSlotClick: (start: Date) => void;
  onBookingClick: (booking: Booking) => void;
  onBookingMove?: (booking: Booking, startsAt: Date, endsAt: Date) => void;
  onDragActiveChange?: (active: boolean) => void;
};

type DragState = {
  booking: Booking;
  durationMs: number;
  grabOffsetY: number;
  pointerId: number;
  originX: number;
  originY: number;
  originDayIndex: number;
  dayIndex: number;
  startsAt: Date;
  endsAt: Date;
  moved: boolean;
};

const DRAG_THRESHOLD_PX = 5;

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

  const columnCount = Math.max(columnEnds.length, 1);
  return { placed, columnCount };
}

function clampStartForDuration(day: Date, start: Date, durationMs: number) {
  const dayStart = new Date(day);
  dayStart.setHours(DAY_START_HOUR, 0, 0, 0);
  const dayEnd = new Date(day);
  dayEnd.setHours(DAY_END_HOUR, 0, 0, 0);

  let nextStart = start;
  if (nextStart.getTime() < dayStart.getTime()) nextStart = dayStart;
  if (nextStart.getTime() + durationMs > dayEnd.getTime()) {
    nextStart = new Date(dayEnd.getTime() - durationMs);
  }
  if (nextStart.getTime() < dayStart.getTime()) nextStart = dayStart;
  return nextStart;
}

export function WeekCalendar({
  weekStart,
  bookings,
  resource,
  highlightId,
  freshIds,
  canDragBooking,
  draggingId = null,
  onSlotClick,
  onBookingClick,
  onBookingMove,
  onDragActiveChange,
}: Props) {
  const totalHeight = hours.length * HOUR_HEIGHT;
  const openFrom = resource.availableFromHour;
  const openTo = resource.availableToHour;
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const current = dragRef.current;
      const grid = gridRef.current;
      if (!current || !grid) return;
      if (e.pointerId !== current.pointerId) return;

      const rect = grid.getBoundingClientRect();
      const colWidth = rect.width / 7;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top - current.grabOffsetY;
      const dayIndex = Math.min(6, Math.max(0, Math.floor(x / colWidth)));
      const day = addDays(weekStart, dayIndex);
      const rawStart = offsetToSnappedTime(day, y);
      const startsAt = clampStartForDuration(day, rawStart, current.durationMs);
      const endsAt = new Date(startsAt.getTime() + current.durationMs);
      const distance = Math.hypot(
        e.clientX - current.originX,
        e.clientY - current.originY,
      );
      const moved = current.moved || distance >= DRAG_THRESHOLD_PX;

      const next: DragState = {
        ...current,
        dayIndex,
        startsAt,
        endsAt,
        moved,
      };
      dragRef.current = next;
      setDrag(next);
    }

    function finishDrag(e: PointerEvent) {
      const current = dragRef.current;
      if (!current || e.pointerId !== current.pointerId) return;
      dragRef.current = null;
      setDrag(null);
      onDragActiveChange?.(false);

      if (!current.moved) {
        onBookingClick(current.booking);
        return;
      }
      onBookingMove?.(current.booking, current.startsAt, current.endsAt);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, [onBookingClick, onBookingMove, onDragActiveChange, weekStart]);

  function beginDrag(
    e: React.PointerEvent,
    booking: Booking,
    dayIndex: number,
  ) {
    if (!canDragBooking?.(booking) || !onBookingMove) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const start = new Date(booking.startsAt);
    const end = new Date(booking.endsAt);
    const durationMs = bookingDurationMs(start, end);
    const blockTop = hourToOffset(start);
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const grabOffsetY = e.clientY - rect.top;

    const next: DragState = {
      booking,
      durationMs,
      grabOffsetY: Number.isFinite(grabOffsetY)
        ? grabOffsetY
        : blockTop % HOUR_HEIGHT,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      originDayIndex: dayIndex,
      dayIndex,
      startsAt: start,
      endsAt: end,
      moved: false,
    };
    dragRef.current = next;
    setDrag(next);
    onDragActiveChange?.(true);
    target.setPointerCapture?.(e.pointerId);
  }

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

        <div
          ref={gridRef}
          className="col-span-7 grid grid-cols-7"
          style={{ height: totalHeight }}
        >
          {days.map((offset) => {
            const day = addDays(weekStart, offset);
            const dayBookings = bookings.filter((b) =>
              sameDay(new Date(b.startsAt), day),
            );
            const { placed, columnCount } = layoutColumns(dayBookings);
            const showGhost = Boolean(drag?.moved && drag.dayIndex === offset);

            return (
              <div
                key={offset}
                className="calendar-grid-bg relative border-l border-ink/8"
                style={{ height: totalHeight }}
                data-day-index={offset}
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
                      onClick={() => {
                        if (dragRef.current) return;
                        onSlotClick(slot);
                      }}
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
                  const isSource =
                    drag?.booking.id === booking.id || draggingId === booking.id;

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Draggable blocks open via pointerup so we don't double-fire after a drag.
                        if (draggable) return;
                        onBookingClick(booking);
                      }}
                      onPointerDown={(e) => beginDrag(e, booking, offset)}
                      className={`absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-white transition hover:brightness-110 ${
                        highlighted
                          ? "border-coral bg-coral animate-coral-flash"
                          : "border-teal/30 bg-teal"
                      } ${fresh ? "animate-spring-in" : ""} ${
                        draggable ? "cursor-grab active:cursor-grabbing touch-none" : ""
                      } ${isSource ? "opacity-35" : ""}`}
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

                {showGhost && drag ? (
                  <div
                    aria-hidden
                    className="pointer-events-none absolute z-20 overflow-hidden rounded-md border border-dashed border-teal/50 bg-teal/70 px-2 py-1 text-left text-white shadow-lg ring-2 ring-teal/30"
                    style={{
                      top: Math.max(hourToOffset(drag.startsAt), 0),
                      height: Math.min(
                        durationHeight(drag.startsAt, drag.endsAt),
                        totalHeight - Math.max(hourToOffset(drag.startsAt), 0),
                      ),
                      left: "2px",
                      width: "calc(100% - 4px)",
                    }}
                  >
                    <div className="truncate text-xs font-semibold">
                      {drag.booking.title}
                    </div>
                    <div className="truncate text-[10px] opacity-90">
                      {initials(drag.booking.host.name)}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
