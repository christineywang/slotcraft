import { describe, expect, it } from "vitest";
import {
  capacityColumnCount,
  countOverlapping,
  intervalsOverlap,
} from "./capacity";

describe("intervalsOverlap", () => {
  it("detects intersection", () => {
    expect(intervalsOverlap(14, 15, 14.5, 15.5)).toBe(true);
  });

  it("allows back-to-back", () => {
    expect(intervalsOverlap(14, 15, 15, 16)).toBe(false);
  });
});

describe("countOverlapping", () => {
  const focus = {
    startsAt: "2026-08-05T14:00:00.000Z",
    endsAt: "2026-08-05T15:00:00.000Z",
  };
  const other = {
    startsAt: "2026-08-05T14:30:00.000Z",
    endsAt: "2026-08-05T15:30:00.000Z",
  };
  const later = {
    startsAt: "2026-08-05T16:00:00.000Z",
    endsAt: "2026-08-05T17:00:00.000Z",
  };

  it("counts self when alone", () => {
    expect(countOverlapping(focus, [focus])).toBe(1);
  });

  it("counts concurrent seat mates", () => {
    expect(countOverlapping(focus, [focus, other, later])).toBe(2);
  });
});

describe("capacityColumnCount", () => {
  it("reserves seat columns for multi-capacity desks", () => {
    expect(capacityColumnCount(1, 2)).toBe(2);
    expect(capacityColumnCount(2, 2)).toBe(2);
    expect(capacityColumnCount(1, 3)).toBe(3);
  });

  it("does not invent columns for exclusive resources", () => {
    expect(capacityColumnCount(1, 1)).toBe(1);
    expect(capacityColumnCount(2, 1)).toBe(2);
  });
});
