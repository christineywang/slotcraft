import { describe, expect, it } from "vitest";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  it("returns ok smoke payload for GET /health", () => {
    const controller = new HealthController();
    expect(controller.check()).toEqual({
      ok: true,
      service: "slotcraft-api",
    });
  });
});
