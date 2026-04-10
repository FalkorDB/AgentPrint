import { describe, it, expect } from "vitest";
import { AI_EVENT_MARKERS } from "@/lib/events";

describe("AI_EVENT_MARKERS", () => {
  it("has entries", () => {
    expect(AI_EVENT_MARKERS.length).toBeGreaterThan(10);
  });

  it("entries have required fields", () => {
    for (const marker of AI_EVENT_MARKERS) {
      expect(marker.date).toMatch(/^\d{4}-\d{2}$/);
      expect(marker.label).toBeTruthy();
    }
  });

  it("entries are in chronological order", () => {
    for (let i = 1; i < AI_EVENT_MARKERS.length; i++) {
      expect(AI_EVENT_MARKERS[i].date >= AI_EVENT_MARKERS[i - 1].date).toBe(true);
    }
  });

  it("all dates are valid months", () => {
    for (const marker of AI_EVENT_MARKERS) {
      const [year, month] = marker.date.split("-").map(Number);
      expect(year).toBeGreaterThanOrEqual(2020);
      expect(month).toBeGreaterThanOrEqual(1);
      expect(month).toBeLessThanOrEqual(12);
    }
  });
});
