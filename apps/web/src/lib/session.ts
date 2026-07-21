"use client";

import type { AuthResponse, Role } from "@slotcraft/shared";

const TOKEN_KEY = "slotcraft.token";
const SESSION_KEY = "slotcraft.session";

export type Session = {
  accessToken: string;
  user: AuthResponse["user"];
  membership: AuthResponse["membership"];
};

export function saveSession(auth: AuthResponse) {
  const session: Session = {
    accessToken: auth.accessToken,
    user: auth.user,
    membership: auth.membership,
  };
  localStorage.setItem(TOKEN_KEY, auth.accessToken);
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(SESSION_KEY);
}

export function getSession(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Session;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function canBook(role: Role) {
  return role === "owner" || role === "admin" || role === "member";
}
