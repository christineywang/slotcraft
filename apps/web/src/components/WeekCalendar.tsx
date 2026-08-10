"use client";

import {
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
  dropTimeFromOffset,
  durationHeight,
  formatHour,
  formatTime,
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
  canDragBooking: (booking: Booking) => boolean;
  onSlotClick: (start: Date) => void;
  onBookingClick: (booking: Booking) => void;
  onBookingMove: (
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
const DRAG_THRESHOLD_PX = 6;
const GUTTER_WIDTH_PX = 64;

type DragSession = {
  booking: Booking;
  durationMs: number;
  pointerId: number;
  originX: number;
  originY: number;
  /** Pointer Y offset from the booking's top edge when grabbed. */
  grabOffsetY: number;
  active: boolean;
  previewStartsAt: Date;
  previewEndsAt: Date;
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
}: Props) {
  const totalHeight = hours.length * HOUR_HEIGHT;
  const openFrom = resource.availableFromHour;
  const openTo = resource.availableToHour;
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragSession | null>(null);
  const suppressClickRef = useRef(false);
  const [drag, setDrag] = useState<DragSession | null>(null);
  const [movingId, setMovingId] = useState<string | null>(null);

  const weekStartRef = useRef(weekStart);
  const openFromRef = useRef(openFrom);
  const openToRef = useRef(openTo);
  const onBookingClickRef = useRef(onBookingClick);
  const onBookingMoveRef = useRef(onBookingMove);
  weekStartRef.current = weekStart;
  openFromRef.current = openFrom;
  openToRef.current = openTo;
  onBookingClickRef.current = onBookingClick;
  onBookingMoveRef.current = onBookingMove;

  function resolveDrop(
    clientX: number,
    clientY: number,
    durationMs: number,
    grabOffsetY: number,
  ) {
    const grid = gridRef.current;
    if (!grid) return null;
    const rect = grid.getBoundingClientRect();
    const x = clientX - rect.left - GUTTER_WIDTH_PX;
    const dayWidth = (rect.width - GUTTER_WIDTH_PX) / 7;
    if (dayWidth <= 0) return null;
    const dayOffset = Math.min(6, Math.max(0, Math.floor(x / dayWidth)));
    const offsetY = clientY - rect.top - grabOffsetY;
    const day = addDays(weekStartRef.current, dayOffset);
    const { startsAt, endsAt } = dropTimeFromOffset(
      day,
      offsetY,
      durationMs,
      openFromRef.current,
      openToRef.current,
    );
    return { dayOffset, startsAt, endsAt };
  }

  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      const session = dragRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      const dx = e.clientX - session.originX;
      const dy = e.clientY - session.originY;
      if (!session.active && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) {
        return;
      }

      const drop = resolveDrop(
        e.clientX,
        e.clientY,
        session.durationMs,
        session.grabOffsetY,
      );
      if (!drop) return;

      const next: DragSession = {
        ...session,
        active: true,
        previewStartsAt: drop.startsAt,
        previewEndsAt: drop.endsAt,
        previewDayOffset: drop.dayOffset,
      };
      dragRef.current = next;
      setDrag(next);
      e.preventDefault();
    }

    async function finishPointer(e: PointerEvent) {
      const session = dragRef.current;
      if (!session || e.pointerId !== session.pointerId) return;

      dragRef.current = null;
      setDrag(null);

      if (!session.active) {
        suppressClickRef.current = true;
        onBookingClickRef.current(session.booking);
        return;
      }

      const unchanged =
        session.previewStartsAt.getTime() ===
          new Date(session.booking.startsAt).getTime() &&
        session.previewEndsAt.getTime() ===
          new Date(session.booking.endsAt).getTime();
      if (unchanged) {
        suppressClickRef.current = true;
        return;
      }

      suppressClickRef.current = true;
      setMovingId(session.booking.id);
      try {
        await onBookingMoveRef.current(
          session.booking,
          session.previewStartsAt,
          session.previewEndsAt,
        );
      } finally {
        setMovingId(null);
      }
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", finishPointer);
    window.addEventListener("pointercancel", finishPointer);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", finishPointer);
      window.removeEventListener("pointercancel", finishPointer);
    };
  }, []);

  function beginDrag(
    e: ReactPointerEvent<HTMLButtonElement>,
    booking: Booking,
  ) {
    if (!canDragBooking(booking) || movingId) return;
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const startsAt = new Date(booking.startsAt);
    const endsAt = new Date(booking.endsAt);
    const durationMs = endsAt.getTime() - startsAt.getTime();
    const dayOffset =
      days.find((offset) =>
        sameDay(addDays(weekStart, offset), startsAt),
      ) ?? 0;
    const gridTop = gridRef.current?.getBoundingClientRect().top ?? 0;
    const grabOffsetY = e.clientY - gridTop - hourToOffset(startsAt);

    const session: DragSession = {
      booking,
      durationMs,
      pointerId: e.pointerId,
      originX: e.clientX,
      originY: e.clientY,
      grabOffsetY,
      active: false,
      previewStartsAt: startsAt,
      previewEndsAt: endsAt,
      previewDayOffset: dayOffset,
    };
    dragRef.current = session;
    setDrag(session);
  }

  const draggingId = drag?.active ? drag.booking.id : null;

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-ink/10 bg-white/70 backdrop-blur ${
        drag?.active ? "select-none" : ""
      }`}
    >
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

      <div
        ref={gridRef}
        className="grid grid-cols-[64px_repeat(7,minmax(0,1fr))]"
      >
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
          const showPreview =
            drag?.active && drag.previewDayOffset === offset;

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
                      if (dragRef.current?.active) return;
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
                  draggingId === booking.id || movingId === booking.id;

                return (
                  <button
                    key={booking.id}
                    type="button"
                    onPointerDown={(e) => beginDrag(e, booking)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (suppressClickRef.current) {
                        suppressClickRef.current = false;
                        return;
                      }
                      // Draggable blocks open via pointerup; non-draggable use click.
                      if (!draggable) onBookingClick(booking);
                    }}
                    aria-grabbed={draggingId === booking.id}
                    aria-label={`${booking.title}, ${formatTime(start)}–${formatTime(end)}${
                      draggable ? ". Drag to reschedule" : ""
                    }`}
                    className={`absolute z-10 overflow-hidden rounded-md border px-2 py-1 text-left text-white transition hover:brightness-110 ${
                      highlighted
                        ? "border-coral bg-coral animate-coral-flash"
                        : "border-teal/30 bg-teal"
                    } ${fresh ? "animate-spring-in" : ""} ${
                      draggable
                        ? "cursor-grab touch-none active:cursor-grabbing"
                        : "cursor-pointer"
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

              {showPreview && drag ? (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-1 z-20 overflow-hidden rounded-md border-2 border-dashed border-teal bg-teal/35 px-2 py-1 text-left text-ink shadow-lg ring-2 ring-teal/40 backdrop-blur-[1px]"
                  style={{
                    top: Math.max(hourToOffset(drag.previewStartsAt), 0),
                    height: Math.min(
                      durationHeight(drag.previewStartsAt, drag.previewEndsAt),
                      totalHeight -
                        Math.max(hourToOffset(drag.previewStartsAt), 0),
                    ),
                  }}
                >
                  <div className="truncate text-xs font-semibold text-teal">
                    {drag.booking.title}
                  </div>
                  <div className="truncate text-[10px] font-medium text-teal/80">
                    {formatTime(drag.previewStartsAt)}–
                    {formatTime(drag.previewEndsAt)}
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
