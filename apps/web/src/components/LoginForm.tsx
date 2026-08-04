"use client";

import { FormEvent, useState } from "react";
import { DEMO_CREDENTIALS } from "@slotcraft/shared";
import { login } from "@/lib/api";
import { saveSession } from "@/lib/session";
import { useRouter } from "next/navigation";

const ROLES = [
  { key: "admin" as const, label: "Admin", hint: "book + manage" },
  { key: "member" as const, label: "Member", hint: "book own" },
  { key: "viewer" as const, label: "Viewer", hint: "read-only" },
];

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState<string>(DEMO_CREDENTIALS.admin.email);
  const [password, setPassword] = useState<string>(DEMO_CREDENTIALS.admin.password);
  const [activeRole, setActiveRole] = useState<"admin" | "member" | "viewer">(
    "admin",
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function pickRole(role: "admin" | "member" | "viewer") {
    setActiveRole(role);
    setEmail(DEMO_CREDENTIALS[role].email);
    setPassword(DEMO_CREDENTIALS[role].password);
    setError(null);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const auth = await login(email, password);
      saveSession(auth);
      router.replace("/calendar");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="w-full max-w-md rounded-2xl border border-ink/10 bg-white/80 p-8 backdrop-blur"
    >
      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-3 w-3 rotate-45 bg-teal"
          />
          <span className="font-display text-3xl tracking-tight text-ink">
            Slotcraft
          </span>
        </div>
        <p className="text-sm leading-relaxed text-ink/70">
          Book shared rooms without the double-book fog
        </p>
      </div>

      <div className="mb-5 grid grid-cols-3 gap-1 rounded-lg border border-ink/10 bg-stone/40 p-1">
        {ROLES.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => pickRole(role.key)}
            className={`rounded-md px-2 py-2 text-center transition ${
              activeRole === role.key
                ? "bg-white text-ink shadow-sm"
                : "text-ink/60 hover:text-ink"
            }`}
          >
            <div className="text-xs font-semibold">{role.label}</div>
            <div className="text-[10px] opacity-70">{role.hint}</div>
          </button>
        ))}
      </div>

      <label className="mb-4 block text-sm">
        <span className="mb-1.5 block font-medium text-ink/80">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 outline-none ring-teal/30 focus:ring-2"
        />
      </label>

      <label className="mb-6 block text-sm">
        <span className="mb-1.5 block font-medium text-ink/80">Password</span>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-ink/15 bg-white px-3 py-2.5 outline-none ring-teal/30 focus:ring-2"
        />
      </label>

      {error ? (
        <p className="mb-4 rounded-lg bg-coral/10 px-3 py-2 text-sm text-coral">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-teal px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-teal-soft disabled:opacity-60"
      >
        {loading ? "Signing in…" : "Continue"}
      </button>

      <p className="mt-6 text-xs leading-relaxed text-ink/55">
        Demo password for all roles:{" "}
        <code className="text-ink/70">{DEMO_CREDENTIALS.admin.password}</code>
      </p>
    </form>
  );
}
