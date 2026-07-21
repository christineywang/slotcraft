"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { Booking } from "@slotcraft/shared";
import { ApiError, cancelBooking, createBooking } from "@/lib/api";
import { canBook, type Session } from "@/lib/session";
import { addHours, formatTime } from "@/lib/dates";

type Props = {
  open: boolean;
  session: Session;
  resourceName: string;
  resourceId: string;
  slotStart: Date | null;
  booking: Booking | null;
  onClose: () => void;
  onCreated: (booking: Booking) => void;
  onCancelled: (bookingId: string) => void;
  conflictBookingId: string | null;
  setConflictBookingId: (id: string | null) => void;
};

export function BookingPanel({
  open,
  session,
  resourceName,
  resourceId,
  slotStart,
  booking,
  onClose,
  onCreated,
  onCancelled,
  conflictBookingId,
  setConflictBookingId,
}: Props) {
  const bookable = canBook(session.membership.role);
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

  useEffect(() => {
    if (!slotStart || !defaultEnd) return;
    setTitle("");
    setNotes("");
    setError(null);
    setConflictBookingId(null);
    setStartsAt(toLocalInput(slotStart));
    setEndsAt(toLocalInput(defaultEnd));
  }, [slotStart, defaultEnd, setConflictBookingId]);

  useEffect(() => {
    if (!booking) return;
    setError(null);
    setConflictBookingId(null);
  }, [booking, setConflictBookingId]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || (!slotStart && !booking)) return null;

  async function onCancel() {
    if (!booking || !bookable) return;
    setLoading(true);
    setError(null);
    try {
      const cancelled = await cancelBooking(booking.id);
      onCancelled(cancelled.id);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setError(err.message || "You’re not allowed to cancel bookings");
      } else {
        setError(err instanceof Error ? err.message : "Could not cancel booking");
      }
      setShake(true);
      window.setTimeout(() => setShake(false), 350);
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!bookable) return;
    setLoading(true);
    setError(null);
    setConflictBookingId(null);
    try {
      const booking = await createBooking({
        resourceId,
        title: title.trim() || "Booking",
        notes: notes.trim() || undefined,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
      });
      onCreated(booking);
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as {
          message?: string | { message?: string; conflict?: { bookingId: string } };
          conflict?: { bookingId: string };
        };
        const nested =
          body && typeof body.message === "object" ? body.message : null;
        const message =
          (typeof body.message === "string" ? body.message : null) ||
          nested?.message ||
          err.message;
        const conflictId =
          body.conflict?.bookingId ?? nested?.conflict?.bookingId ?? null;
        setError(message);
        setConflictBookingId(conflictId);
        setShake(true);
        window.setTimeout(() => setShake(false), 350);
      } else if (err instanceof ApiError && err.status === 403) {
        setError(err.message);
      } else {
        setError(err instanceof Error ? err.message : "Could not create booking");
      }
    } finally {
      setLoading(false);
    }
  }

  if (booking) {
    const start = new Date(booking.startsAt);
    const end = new Date(booking.endsAt);
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
                Booking
              </p>
              <h2 className="font-display text-2xl text-ink">{resourceName}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-ink/55 hover:text-ink"
            >
              Close
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-4 px-6 py-5">
            {!bookable ? (
              <p className="rounded-lg bg-ink/5 px-3 py-2 text-sm text-ink/70">
                Viewers can’t cancel bookings
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

            <div>
              <p className="text-sm font-medium text-ink">{booking.title}</p>
              <p className="text-sm text-ink/60">
                {start.toLocaleDateString("en-US", {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
                {" · "}
                {formatTime(start)} – {formatTime(end)}
              </p>
              <p className="mt-1 text-sm text-ink/60">
                Hosted by {booking.host.name}
              </p>
            </div>

            {booking.notes ? (
              <p className="rounded-lg bg-stone/50 px-3 py-2 text-sm text-ink/70">
                {booking.notes}
              </p>
            ) : null}

            {bookable ? (
              <div className="mt-auto pt-4">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={loading}
                  className="w-full rounded-lg bg-coral/90 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-coral disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? "Cancelling…" : "Cancel booking"}
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </>
    );
  }

  if (!slotStart) return null;

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
              New booking
            </p>
            <h2 className="font-display text-2xl text-ink">{resourceName}</h2>
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
              Viewers can’t create bookings
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
              disabled={!bookable}
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
                disabled={!bookable}
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2 disabled:bg-stone/50"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Ends</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                disabled={!bookable}
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2 disabled:bg-stone/50"
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              disabled={!bookable}
              rows={3}
              className="w-full resize-none rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2 disabled:bg-stone/50"
            />
          </label>

          <p className="text-xs text-ink/50">
            Prefill: {formatTime(slotStart)}
            {conflictBookingId ? " · conflicting block highlighted on the grid" : ""}
          </p>

          <div className="mt-auto pt-4">
            <button
              type="submit"
              disabled={!bookable || loading}
              className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-soft disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Booking…" : "Book"}
            </button>
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
