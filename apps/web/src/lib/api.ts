import type {
  AuthResponse,
  Booking,
  CreateBookingInput,
  CreateResourceInput,
  Resource,
  UpdateBookingInput,
  UpdateResourceInput,
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

export function createResource(input: CreateResourceInput) {
  return request<Resource>("/resources", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateResource(id: string, input: UpdateResourceInput) {
  return request<Resource>(`/resources/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteResource(id: string) {
  return request<{ id: string; deleted: boolean }>(`/resources/${id}`, {
    method: "DELETE",
  });
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

export function updateBooking(id: string, input: UpdateBookingInput) {
  return request<Booking>(`/bookings/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function cancelBooking(id: string) {
  return request<Booking>(`/bookings/${id}`, {
    method: "DELETE",
  });
}

/** Nest ConflictException nests payload under `message` sometimes. */
export function extractConflict(err: ApiError): {
  message: string;
  bookingId: string | null;
} {
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
  const bookingId =
    body.conflict?.bookingId ?? nested?.conflict?.bookingId ?? null;
  return { message, bookingId };
}
