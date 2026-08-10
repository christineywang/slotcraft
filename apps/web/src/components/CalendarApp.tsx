"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Booking, Resource } from "@slotcraft/shared";
import {
  ApiError,
  extractConflict,
  listBookings,
  listResources,
  updateBooking,
} from "@/lib/api";
import {
  canBook,
  canEditBooking,
  canManageResources,
  clearSession,
  getSession,
  type Session,
} from "@/lib/session";
import {
  addDays,
  formatWeekLabel,
  startOfWeek,
} from "@/lib/dates";
import { WeekCalendar } from "@/components/WeekCalendar";
import { BookingPanel } from "@/components/BookingPanel";
import { ResourceAdmin } from "@/components/ResourceAdmin";

export function CalendarApp() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [resourceId, setResourceId] = useState<string | null>(null);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [adminOpen, setAdminOpen] = useState(false);
  const [slotStart, setSlotStart] = useState<Date | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [conflictId, setConflictId] = useState<string | null>(null);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const s = getSession();
    if (!s) {
      router.replace("/");
      return;
    }
    setSession(s);
  }, [router]);

  useEffect(() => {
    if (!session) return;
    listResources()
      .then((items) => {
        setResources(items);
        setResourceId((prev) => prev ?? items[0]?.id ?? null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load"));
  }, [session]);

  const range = useMemo(() => {
    const from = weekStart;
    const to = addDays(weekStart, 7);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [weekStart]);

  const refreshBookings = useCallback(async (silent = false) => {
    if (!resourceId) return;
    if (!silent) setLoading(true);
    try {
      const items = await listBookings(resourceId, range.from, range.to);
      setBookings(items);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [resourceId, range.from, range.to]);

  useEffect(() => {
    void refreshBookings();
  }, [refreshBookings]);

  // Light polling so a second browser tab feels "live" during demos.
  useEffect(() => {
    if (!resourceId || panelOpen || adminOpen || dragging) return;
    const id = window.setInterval(() => {
      void refreshBookings(true);
    }, 8000);
    return () => window.clearInterval(id);
  }, [resourceId, panelOpen, adminOpen, dragging, refreshBookings]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (panelOpen || adminOpen) return;
      if (e.key === "ArrowLeft") {
        setWeekStart((w) => addDays(w, -7));
      } else if (e.key === "ArrowRight") {
        setWeekStart((w) => addDays(w, 7));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, adminOpen]);

  const selected = resources.find((r) => r.id === resourceId) ?? null;
  const bookable = session ? canBook(session.membership.role) : false;
  const manageResources = session
    ? canManageResources(session.membership.role)
    : false;

  function markFresh(id: string) {
    setFreshIds((prev) => new Set(prev).add(id));
    window.setTimeout(() => {
      setFreshIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 400);
  }

  const handleBookingMove = useCallback(
    async (booking: Booking, startsAt: Date, endsAt: Date) => {
      const optimistic: Booking = {
        ...booking,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      };
      setDragging(true);
      setError(null);
      setConflictId(null);
      setBookings((prev) =>
        prev.map((b) => (b.id === booking.id ? optimistic : b)),
      );
      try {
        const updated = await updateBooking(booking.id, {
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
        });
        setBookings((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b)),
        );
        markFresh(updated.id);
      } catch (err) {
        setBookings((prev) =>
          prev.map((b) => (b.id === booking.id ? booking : b)),
        );
        if (err instanceof ApiError && err.status === 409) {
          const { message, bookingId } = extractConflict(err);
          setError(message);
          setConflictId(bookingId);
        } else if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError(
            err instanceof Error ? err.message : "Could not reschedule booking",
          );
        }
      } finally {
        setDragging(false);
      }
    },
    [],
  );

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-ink/60">
        Loading…
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-5 sm:px-6">
      <header className="mb-5 flex flex-wrap items-center gap-3 border-b border-ink/10 pb-4">
        <div className="mr-auto flex items-center gap-2">
          <span aria-hidden className="inline-block h-2.5 w-2.5 rotate-45 bg-teal" />
          <span className="font-display text-2xl tracking-tight">Slotcraft</span>
          <span className="hidden text-sm text-ink/45 sm:inline">
            · {session.membership.organizationName}
          </span>
        </div>

        <div className="flex flex-wrap gap-1 rounded-lg border border-ink/10 bg-white/70 p-1">
          {resources.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setResourceId(r.id)}
              className={`rounded-md px-3 py-1.5 text-sm transition ${
                r.id === resourceId
                  ? "bg-teal text-white"
                  : "text-ink/70 hover:bg-ink/5"
              }`}
            >
              {r.name}
              {r.capacity > 1 ? (
                <span className="ml-1 opacity-80">×{r.capacity}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="rounded-md border border-ink/10 bg-white/80 px-2.5 py-1.5 text-sm"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(startOfWeek(new Date()))}
            className="rounded-md border border-ink/10 bg-white/80 px-2.5 py-1.5 text-sm"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((w) => addDays(w, 7))}
            className="rounded-md border border-ink/10 bg-white/80 px-2.5 py-1.5 text-sm"
          >
            Next
          </button>
          {manageResources ? (
            <button
              type="button"
              onClick={() => setAdminOpen(true)}
              className="rounded-md border border-ink/10 bg-white/80 px-2.5 py-1.5 text-sm"
            >
              Resources
            </button>
          ) : null}
        </div>

        <div className="text-right text-xs text-ink/55">
          <div className="font-medium text-ink/80">{session.user.name}</div>
          <div className="capitalize">{session.membership.role}</div>
          <button
            type="button"
            className="mt-1 underline-offset-2 hover:underline"
            onClick={() => {
              clearSession();
              router.replace("/");
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-ink">
            {selected?.name ?? "Select a resource"}
          </h1>
          <p className="text-sm text-ink/55">
            {formatWeekLabel(weekStart)}
            {selected
              ? ` · ${selected.availableFromHour}:00–${selected.availableToHour}:00`
              : ""}
            {selected && selected.capacity > 1
              ? ` · ${selected.capacity} seats`
              : ""}
          </p>
        </div>
        {loading ? (
          <span className="text-xs text-ink/45">Refreshing…</span>
        ) : !bookable ? (
          <span className="text-xs text-ink/45">View-only</span>
        ) : (
          <span className="text-xs text-ink/45">
            Click a slot · drag a booking to reschedule
          </span>
        )}
      </div>

      {error ? (
        <p className="mb-3 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      ) : null}

      {selected ? (
        <WeekCalendar
          weekStart={weekStart}
          bookings={bookings}
          resource={selected}
          highlightId={conflictId}
          freshIds={freshIds}
          canDragBooking={(booking) =>
            canEditBooking(
              session.membership.role,
              booking.host.id,
              session.user.id,
            )
          }
          onSlotClick={(start) => {
            setEditing(null);
            setSlotStart(start);
            setConflictId(null);
            setError(null);
            setPanelOpen(true);
          }}
          onBookingClick={(booking) => {
            setSlotStart(null);
            setEditing(booking);
            setConflictId(null);
            setError(null);
            setPanelOpen(true);
          }}
          onBookingMove={handleBookingMove}
        />
      ) : null}

      {selected ? (
        <BookingPanel
          open={panelOpen}
          session={session}
          resourceName={selected.name}
          resourceId={selected.id}
          availableFromHour={selected.availableFromHour}
          availableToHour={selected.availableToHour}
          capacity={selected.capacity}
          slotStart={slotStart}
          editing={editing}
          onClose={() => {
            setPanelOpen(false);
            setEditing(null);
            setSlotStart(null);
          }}
          conflictBookingId={conflictId}
          setConflictBookingId={setConflictId}
          onCreated={(booking) => {
            setBookings((prev) => [...prev, booking]);
            markFresh(booking.id);
          }}
          onUpdated={(booking) => {
            setBookings((prev) =>
              prev.map((b) => (b.id === booking.id ? booking : b)),
            );
            markFresh(booking.id);
          }}
          onCancelled={(bookingId) => {
            setBookings((prev) => prev.filter((b) => b.id !== bookingId));
          }}
        />
      ) : null}

      <ResourceAdmin
        open={adminOpen}
        resources={resources}
        onClose={() => setAdminOpen(false)}
        onChanged={(next) => {
          setResources(next);
          if (resourceId && !next.some((r) => r.id === resourceId)) {
            setResourceId(next[0]?.id ?? null);
          }
        }}
      />
    </main>
  );
}
