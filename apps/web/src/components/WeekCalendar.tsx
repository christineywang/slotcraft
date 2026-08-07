"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { Booking, Resource } from "@slotcraft/shared";
import {
  DAY_END_HOUR,
  DAY_START_HOUR,
  HOUR_HEIGHT,
  addDays,
  clampBookingOffset,
  dateFromDayAndOffset,
  durationHeight,
  formatHour,
  hourToOffset,
  initials,
  sameDay,
  snapOffset,
} from "@/lib/dates";

type Props = {
  weekStart: Date;
  bookings: Booking[];
  resource: Resource;
  highlightId: string | null;
  freshIds: Set<string>;
  canDragBooking: (booking: Booking) => boolean;
  onSlotClick: (start: Date) => void;
  onBookingClick: (booking: Booking) => void;
  onBookingMove: (
    booking: Booking,
    startsAt: Date,
    endsAt: Date,
  ) => void | Promise<void>;
  onDragActiveChange?: (active: boolean) => void;
};

const hours = Array.from(
  { length: DAY_END_HOUR - DAY_START_HOUR },
  (_, i) => DAY_START_HOUR + i,
);
const days = Array.from({ length: 7 }, (_, i) => i);
const DRAG_THRESHOLD_PX = 6;

type DragState = {
  booking: Booking;
  pointerId: number;
  originClientX: number;
  originClientY: number;
  grabOffsetY: number;
  durationMs: number;
  moved: boolean;
  previewTop: number;
  previewDayOffset: number;
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

export function WeekCalendar({
  weekStart,
  bookings,
  resource,
  highlightId,
  freshIds,
  canDragBooking,
  onSlotClick,
  onBookingClick,
  onBookingMove,
  onDragActiveChange,
}: Props) {
  const totalHeight = hours.length * HOUR_HEIGHT;
  const openFrom = resource.availableFromHour;
  const openTo = resource.availableToHour;
  const daysContainerRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);

  function publishDrag(next: DragState | null) {
    dragRef.current = next;
    setDrag(next);
  }

  function dayOffsetFromClientX(clientX: number) {
    const el = daysContainerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0) return 0;
    const ratio = (clientX - rect.left) / rect.width;
    return Math.max(0, Math.min(6, Math.floor(ratio * 7)));
  }

  function topFromClientY(clientY: number, grabOffsetY: number, durationMs: number) {
    const el = daysContainerRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const rawTop = clientY - rect.top - grabOffsetY;
    const snapped = snapOffset(rawTop);
    return clampBookingOffset(snapped, durationMs, openFrom, openTo);
  }

  function beginDrag(
    booking: Booking,
    dayOffset: number,
    e: ReactPointerEvent<HTMLButtonElement>,
  ) {
    if (!canDragBooking(booking)) return;
    const start = new Date(booking.startsAt);
    const end = new Date(booking.endsAt);
    const top = Math.max(hourToOffset(start), 0);
    const target = e.currentTarget;
    const rect = target.getBoundingClientRect();
    const grabOffsetY = e.clientY - rect.top;
    const durationMs = end.getTime() - start.getTime();

    target.setPointerCapture(e.pointerId);
    onDragActiveChange?.(true);
    publishDrag({
      booking,
      pointerId: e.pointerId,
      originClientX: e.clientX,
      originClientY: e.clientY,
      grabOffsetY,
      durationMs,
      moved: false,
      previewTop: top,
      previewDayOffset: dayOffset,
    });
  }

  function updateDrag(e: ReactPointerEvent) {
    const prev = dragRef.current;
    if (!prev || prev.pointerId !== e.pointerId) return;
    const distance = Math.hypot(
      e.clientX - prev.originClientX,
      e.clientY - prev.originClientY,
    );
    const moved = prev.moved || distance >= DRAG_THRESHOLD_PX;
    if (!moved) return;
    publishDrag({
      ...prev,
      moved: true,
      previewDayOffset: dayOffsetFromClientX(e.clientX),
      previewTop: topFromClientY(e.clientY, prev.grabOffsetY, prev.durationMs),
    });
  }

  function endDrag(e: ReactPointerEvent) {
    const current = dragRef.current;
    if (!current || current.pointerId !== e.pointerId) return;

    try {
      e.currentTarget.releasePointerCapture?.(e.pointerId);
    } catch {
      // Pointer may already be released.
    }

    onDragActiveChange?.(false);
    publishDrag(null);

    if (!current.moved) {
      onBookingClick(current.booking);
      return;
    }

    const day = addDays(weekStart, current.previewDayOffset);
    const startsAt = dateFromDayAndOffset(day, current.previewTop);
    const endsAt = new Date(startsAt.getTime() + current.durationMs);
    const prevStart = new Date(current.booking.startsAt).getTime();
    const prevEnd = new Date(current.booking.endsAt).getTime();
    if (startsAt.getTime() === prevStart && endsAt.getTime() === prevEnd) {
      return;
    }
    void onBookingMove(current.booking, startsAt, endsAt);
  }

  const previewHeight = drag
    ? Math.max((drag.durationMs / (60 * 60 * 1000)) * HOUR_HEIGHT, 28)
    : 0;

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

      <div className="grid grid-cols-[64px_minmax(0,1fr)]">
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
          ref={daysContainerRef}
          className="relative grid grid-cols-7"
          style={{ height: totalHeight }}
        >
          {days.map((offset) => {
            const day = addDays(weekStart, offset);
            const dayBookings = bookings.filter((b) =>
              sameDay(new Date(b.startsAt), day),
            );
            const { placed, columnCount } = layoutColumns(dayBookings);

            return (
              <div
                key={offset}
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
                      onClick={() => {
                        if (drag?.moved) return;
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
                  const draggable = canDragBooking(booking);
                  const isSource =
                    drag?.booking.id === booking.id && drag.moved;

                  return (
                    <button
                      key={booking.id}
                      type="button"
                      aria-grabbed={
                        drag?.booking.id === booking.id ? true : undefined
                      }
                      onPointerDown={(e) => {
                        if (e.button !== 0) return;
                        if (!draggable) return;
                        beginDrag(booking, offset, e);
                      }}
                      onPointerMove={draggable ? updateDrag : undefined}
                      onPointerUp={draggable ? endDrag : undefined}
                      onPointerCancel={draggable ? endDrag : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Draggable bookings open via pointerup (so drag ≠ click).
                        if (!draggable) onBookingClick(booking);
                      }}
                      className={`absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-white transition hover:brightness-110 touch-none ${
                        highlighted
                          ? "border-coral bg-coral animate-coral-flash"
                          : "border-teal/30 bg-teal"
                      } ${fresh ? "animate-spring-in" : ""} ${
                        draggable ? "cursor-grab active:cursor-grabbing" : ""
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
              </div>
            );
          })}

          {drag?.moved ? (
            <div
              aria-hidden
              className="pointer-events-none absolute z-20 overflow-hidden rounded-md border border-teal/40 bg-teal/90 px-2 py-1 text-left text-white shadow-lg ring-2 ring-teal/30"
              style={{
                top: drag.previewTop,
                height: Math.min(previewHeight, totalHeight - drag.previewTop),
                left: `calc(${(drag.previewDayOffset / 7) * 100}% + 2px)`,
                width: `calc(${100 / 7}% - 4px)`,
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
      </div>
    </div>
  );
}
