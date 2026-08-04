"use client";

import { FormEvent, useEffect, useState } from "react";
import type { Resource } from "@slotcraft/shared";
import {
  ApiError,
  createResource,
  deleteResource,
  updateResource,
} from "@/lib/api";

type Props = {
  open: boolean;
  resources: Resource[];
  onClose: () => void;
  onChanged: (resources: Resource[]) => void;
};

export function ResourceAdmin({ open, resources, onClose, onChanged }: Props) {
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState(1);
  const [fromHour, setFromHour] = useState(8);
  const [toHour, setToHour] = useState(20);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) {
      resetForm();
    }
  }, [open]);

  if (!open) return null;

  function resetForm() {
    setName("");
    setCapacity(1);
    setFromHour(8);
    setToHour(20);
    setEditingId(null);
    setError(null);
  }

  function startEdit(resource: Resource) {
    setEditingId(resource.id);
    setName(resource.name);
    setCapacity(resource.capacity);
    setFromHour(resource.availableFromHour);
    setToHour(resource.availableToHour);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (editingId) {
        const updated = await updateResource(editingId, {
          name: name.trim(),
          capacity,
          availableFromHour: fromHour,
          availableToHour: toHour,
        });
        onChanged(resources.map((r) => (r.id === updated.id ? updated : r)));
      } else {
        const created = await createResource({
          name: name.trim(),
          capacity,
          availableFromHour: fromHour,
          availableToHour: toHour,
        });
        onChanged([...resources, created].sort((a, b) => a.name.localeCompare(b.name)));
      }
      resetForm();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Could not save resource",
      );
    } finally {
      setLoading(false);
    }
  }

  async function onDelete(id: string) {
    if (!window.confirm("Delete this resource and its bookings?")) return;
    setError(null);
    try {
      await deleteResource(id);
      onChanged(resources.filter((r) => r.id !== id));
      if (editingId === id) resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete resource");
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close resources panel"
        className="fixed inset-0 z-40 bg-ink/20"
        onClick={onClose}
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md animate-slide-in flex-col border-l border-ink/10 bg-white shadow-panel">
        <div className="flex items-start justify-between border-b border-ink/10 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.14em] text-ink/45">
              Admin
            </p>
            <h2 className="font-display text-2xl text-ink">Resources</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink/55 hover:text-ink"
          >
            Close
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
          <ul className="space-y-2">
            {resources.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="text-xs text-ink/50">
                    cap {r.capacity} · {r.availableFromHour}:00–
                    {r.availableToHour}:00
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => startEdit(r)}
                  className="text-xs text-teal hover:underline"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void onDelete(r.id)}
                  className="text-xs text-coral hover:underline"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>

          <form onSubmit={onSubmit} className="space-y-3 border-t border-ink/10 pt-4">
            <p className="text-sm font-medium text-ink/80">
              {editingId ? "Edit resource" : "Add resource"}
            </p>

            {error ? (
              <p className="rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
                {error}
              </p>
            ) : null}

            <label className="block text-sm">
              <span className="mb-1.5 block font-medium">Name</span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2"
              />
            </label>

            <div className="grid grid-cols-3 gap-2">
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Capacity</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  required
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Opens</span>
                <input
                  type="number"
                  min={0}
                  max={23}
                  required
                  value={fromHour}
                  onChange={(e) => setFromHour(Number(e.target.value))}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2"
                />
              </label>
              <label className="block text-sm">
                <span className="mb-1.5 block font-medium">Closes</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  required
                  value={toHour}
                  onChange={(e) => setToHour(Number(e.target.value))}
                  className="w-full rounded-lg border border-ink/15 px-3 py-2.5 outline-none ring-teal/30 focus:ring-2"
                />
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-soft disabled:opacity-50"
              >
                {loading ? "Saving…" : editingId ? "Save" : "Add"}
              </button>
              {editingId ? (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-ink/15 px-4 py-2.5 text-sm"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </form>
        </div>
      </aside>
    </>
  );
}
