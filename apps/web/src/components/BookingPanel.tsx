"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Booking } from "@slotcraft/shared";
import {
  ApiError,
  cancelBooking,
  createBooking,
  extractConflict,
  updateBooking,
} from "@/lib/api";
import { canBook, canEditBooking, type Session } from "@/lib/session";
import { addHours, formatTime } from "@/lib/dates";

type Props = {
  open: boolean;
  session: Session;
  resourceName: string;
  resourceId: string;
  availableFromHour: number;
  availableToHour: number;
  capacity: number;
  slotStart: Date | null;
  editing: Booking | null;
  onClose: () => void;
  onCreated: (booking: Booking) => void;
  onUpdated: (booking: Booking) => void;
  onCancelled: (bookingId: string) => void;
  conflictBookingId: string | null;
  setConflictBookingId: (id: string | null) => void;
};

export function BookingPanel({
  open,
  session,
  resourceName,
  resourceId,
  availableFromHour,
  availableToHour,
  capacity,
  slotStart,
  editing,
  onClose,
  onCreated,
  onUpdated,
  onCancelled,
  conflictBookingId,
  setConflictBookingId,
}: Props) {
  const isEdit = Boolean(editing);
  const bookable = canBook(session.membership.role);
  const editable = editing
    ? canEditBooking(
        session.membership.role,
        editing.host.id,
        session.user.id,
      )
    : bookable;

  const defaultEnd = useMemo(
    () => (slotStart ? addHours(slotStart, 1) : null),
    [slotStart],
  );

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setNotes(editing.notes ?? "");
      setStartsAt(toLocalInput(new Date(editing.startsAt)));
      setEndsAt(toLocalInput(new Date(editing.endsAt)));
      setError(null);
      setConflictBookingId(null);
      return;
    }
    if (!slotStart || !defaultEnd) return;
    setTitle("");
    setNotes("");
    setError(null);
    setConflictBookingId(null);
    setStartsAt(toLocalInput(slotStart));
    setEndsAt(toLocalInput(defaultEnd));
  }, [slotStart, defaultEnd, editing, setConflictBookingId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || (!slotStart && !editing)) return null;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!editable) return;
    setLoading(true);
    setError(null);
    setConflictBookingId(null);
    try {
      if (editing) {
        const booking = await updateBooking(editing.id, {
          title: title.trim() || "Booking",
          notes: notes.trim() || null,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        });
        onUpdated(booking);
        onClose();
      } else {
        const booking = await createBooking({
          resourceId,
          title: title.trim() || "Booking",
          notes: notes.trim() || undefined,
          startsAt: new Date(startsAt).toISOString(),
          endsAt: new Date(endsAt).toISOString(),
        });
        onCreated(booking);
        onClose();
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const { message, bookingId } = extractConflict(err);
        setError(message);
        setConflictBookingId(bookingId);
        setShake(true);
        window.setTimeout(() => setShake(false), 350);
      } else if (err instanceof ApiError) {
        setError(err.message);
        if (err.status === 400) {
          setShake(true);
          window.setTimeout(() => setShake(false), 350);
        }
      } else {
        setError(err instanceof Error ? err.message : "Could not save booking");
      }
    } finally {
      setLoading(false);
    }
  }

  async function onCancelBooking() {
    if (!editing || !editable) return;
    setCancelling(true);
    setError(null);
    try {
      await cancelBooking(editing.id);
      onCancelled(editing.id);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel booking");
    } finally {
      setCancelling(false);
    }
  }

  const hoursLabel = `${formatHourLabel(availableFromHour)}–${formatHourLabel(availableToHour)}`;

  return (
    <>
      <button
        type="button"
        aria-label="Close booking panel"
        className="fixed inset-0 z-40 bg-ink/20"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md animate-slide-in flex-col border-l border-ink/10 bg-white shadow-panel">
        <div className="flex items-start justify-between border-b border-ink/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-ink/45">
              {isEdit ? "Edit booking" : "New booking"}
            </p>
            <h2 className="font-display text-2xl text-ink">{resourceName}</h2>
            <p className="mt-1 text-xs text-ink/50">
              Open {hoursLabel}
              {capacity > 1 ? ` · capacity ${capacity}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink/55 hover:text-ink"
          >
            Close
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-1 flex-col gap-4 px-6 py-5">
          {!bookable ? (
            <p className="rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/70">
              Viewers can’t create or edit bookings
            </p>
          ) : null}

          {isEdit && bookable && !editable ? (
            <p className="rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/70">
              Members can only edit or cancel their own bookings
            </p>
          ) : null}

          {editing ? (
            <p className="text-xs text-ink/50">
              Hosted by {editing.host.name}
            </p>
          ) : null}

          {error ? (
            <p
              className={`rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral ${
                shake ? "animate-shake" : ""
              }`}
            >
              {error}
            </p>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!editable}
              placeholder="Working session"
              className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2 disabled:bg-stone/50"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Starts</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                disabled={!editable}
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2 disabled:bg-stone/50"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={!editable}
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2 disabled:bg-stone/50"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!editable}
              rows={3}
              className="w-full resize-none rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2 disabled:bg-stone/50"
            />
          </label>

          <p className="text-xs text-ink/50">
            {slotStart && !isEdit ? `Prefill: ${formatTime(slotStart)}` : null}
            {conflictBookingId
              ? " · conflicting block highlighted on the grid"
              : ""}
          </p>

          <div className="mt-auto flex flex-col gap-2 pt-4">
            <button
              type="submit"
              disabled={!editable || loading}
              className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? isEdit
                  ? "Saving…"
                  : "Booking…"
                : isEdit
                  ? "Save changes"
                  : "Book"}
            </button>
            {isEdit ? (
              <button
                type="button"
                disabled={!editable || cancelling}
                onClick={() => void onCancelBooking()}
                className="w-full rounded-lg border border-coral/40 px-4 py-2.5 text-sm font-semibold text-coral transition hover:bg-coral/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {cancelling ? "Cancelling…" : "Cancel booking"}
              </button>
            ) : null}
          </div>
        </form>
      </aside>
    </>
  );
}

function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatHourLabel(hour: number) {
  const d = new Date();
  d.setHours(hour, 0, 0, 0);
  return d.toLocaleTimeString("en-US", { hour: "numeric" });
}
