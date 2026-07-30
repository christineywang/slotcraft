import type {
  AuthResponse,
  Booking,
  CreateBookingInput,
  Resource,
} from "@slotcraft/shared";
import { getToken, clearSession } from "./session";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body?: unknown) {
    super(message);
    this.status = status;
    this.body = body;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  auth = true,
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (auth) {
    const token = getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;

  if (!res.ok) {
    if (res.status === 401) {
      clearSession();
    }
    const message =
      (body && typeof body === "object" && "message" in body
        ? Array.isArray((body as { message: unknown }).message)
          ? (body as { message: string[] }).message.join(", ")
          : String((body as { message: unknown }).message)
        : null) || res.statusText;
    throw new ApiError(res.status, message, body);
  }

  return body as T;
}

export function login(email: string, password: string) {
  return request<AuthResponse>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
    false,
  );
}

export function listResources() {
  return request<Resource[]>("/resources");
}

export function listBookings(resourceId: string, from: string, to: string) {
  const q = new URLSearchParams({ from, to });
  return request<Booking[]>(`/resources/${resourceId}/bookings?${q}`);
}

export function createBooking(input: CreateBookingInput) {
  return request<Booking>("/bookings", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function cancelBooking(id: string) {
  return request<Booking>(`/bookings/${id}`, {
    method: "DELETE",
  });
}
