import { describe, expect, it } from "vitest";
import { isClosedHour } from "@slotcraft/shared";
import {
  canMutateBooking,
  isAtCapacity,
  isWithinAvailability,
  overlaps,
} from "./booking-rules";

describe("overlaps", () => {
  it("detects intersecting intervals", () => {
    const a0 = new Date("2026-08-05T14:00:00");
    const a1 = new Date("2026-08-05T15:00:00");
    const b0 = new Date("2026-08-05T14:30:00");
    const b1 = new Date("2026-08-05T15:30:00");
    expect(overlaps(a0, a1, b0, b1)).toBe(true);
  });

  it("allows back-to-back bookings", () => {
    const a0 = new Date("2026-08-05T14:00:00");
    const a1 = new Date("2026-08-05T15:00:00");
    const b0 = new Date("2026-08-05T15:00:00");
    const b1 = new Date("2026-08-05T16:00:00");
    expect(overlaps(a0, a1, b0, b1)).toBe(false);
  });
});

describe("isAtCapacity", () => {
  it("treats capacity 1 as exclusive", () => {
    expect(isAtCapacity(1, 1)).toBe(true);
    expect(isAtCapacity(0, 1)).toBe(false);
  });

  it("allows concurrent seats until full", () => {
    expect(isAtCapacity(1, 2)).toBe(false);
    expect(isAtCapacity(2, 2)).toBe(true);
  });
});

describe("isWithinAvailability", () => {
  it("accepts bookings inside open hours", () => {
    const start = new Date(2026, 7, 5, 9, 0, 0);
    const end = new Date(2026, 7, 5, 10, 0, 0);
    expect(isWithinAvailability(start, end, 9, 18)).toBe(true);
  });

  it("rejects bookings that start before open", () => {
    const start = new Date(2026, 7, 5, 8, 0, 0);
    const end = new Date(2026, 7, 5, 9, 0, 0);
    expect(isWithinAvailability(start, end, 9, 18)).toBe(false);
  });

  it("rejects bookings that end after close", () => {
    const start = new Date(2026, 7, 5, 17, 0, 0);
    const end = new Date(2026, 7, 5, 19, 0, 0);
    expect(isWithinAvailability(start, end, 9, 18)).toBe(false);
  });

  it("rejects multi-day intervals", () => {
    const start = new Date(2026, 7, 5, 16, 0, 0);
    const end = new Date(2026, 7, 6, 10, 0, 0);
    expect(isWithinAvailability(start, end, 8, 20)).toBe(false);
  });
});

describe("isClosedHour", () => {
  it("marks Studio A hours outside 9–18 as closed", () => {
    expect(isClosedHour(8, 9, 18)).toBe(true);
    expect(isClosedHour(9, 9, 18)).toBe(false);
    expect(isClosedHour(17, 9, 18)).toBe(false);
    expect(isClosedHour(18, 9, 18)).toBe(true);
    expect(isClosedHour(19, 9, 18)).toBe(true);
  });
});

describe("canMutateBooking", () => {
  it("blocks viewers", () => {
    expect(canMutateBooking("viewer", "host", "viewer")).toBe(false);
  });

  it("lets admins edit anyone’s booking", () => {
    expect(canMutateBooking("admin", "host", "admin")).toBe(true);
  });

  it("lets members edit only their own", () => {
    expect(canMutateBooking("member", "host", "host")).toBe(true);
    expect(canMutateBooking("member", "host", "other")).toBe(false);
  });
});
