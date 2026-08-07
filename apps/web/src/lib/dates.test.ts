import { describe, expect, it } from "vitest";
import {
  DAY_START_HOUR,
  HOUR_HEIGHT,
  clampBookingOffset,
  dateFromDayAndOffset,
  snapOffset,
} from "./dates";

describe("calendar drag helpers", () => {
  it("snaps offsets to 15-minute increments", () => {
    const hourNine = (9 - DAY_START_HOUR) * HOUR_HEIGHT;
    expect(snapOffset(hourNine + 3)).toBe(hourNine);
    expect(snapOffset(hourNine + HOUR_HEIGHT / 4 + 2)).toBe(
      hourNine + HOUR_HEIGHT / 4,
    );
  });

  it("builds a date from day + offset", () => {
    const day = new Date(2026, 7, 3, 0, 0, 0, 0);
    const offset = (10 - DAY_START_HOUR) * HOUR_HEIGHT + HOUR_HEIGHT / 2;
    const result = dateFromDayAndOffset(day, offset);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
  });

  it("clamps bookings inside availability", () => {
    const oneHour = 60 * 60 * 1000;
    const tooEarly = clampBookingOffset(-100, oneHour, 9, 17);
    expect(tooEarly).toBe((9 - DAY_START_HOUR) * HOUR_HEIGHT);

    const late = (16.5 - DAY_START_HOUR) * HOUR_HEIGHT;
    const clamped = clampBookingOffset(late, oneHour, 9, 17);
    expect(clamped).toBe((16 - DAY_START_HOUR) * HOUR_HEIGHT);
  });
});
