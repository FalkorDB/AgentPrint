import { describe, it, expect, vi } from "vitest";

// Mock prisma before importing score module
vi.mock("@/lib/db", () => ({
  prisma: {},
}));

import { computeScore } from "@/lib/metrics/score";

function makeMonth(
  month: string,
  overrides: Partial<{
    activeDevs: number;
    activeCodeContributors: number;
    linesChangedPerDev: number | null;
    prMergeRatePerDev: number | null;
    prRejectionRate: number | null;
    firstTimeContribRatio: number | null;
    medianTtmHours: number | null;
    medianTtcHours: number | null;
  }> = {}
) {
  return {
    month,
    activeDevs: 5,
    activeCodeContributors: 4,
    linesChangedPerDev: 500,
    prMergeRatePerDev: 2,
    prRejectionRate: 0.1,
    firstTimeContribRatio: 0.05,
    medianTtmHours: 24,
    medianTtcHours: 48,
    ...overrides,
  };
}

function generateMonths(count: number, startYear = 2023, startMonth = 1) {
  const months = [];
  for (let i = 0; i < count; i++) {
    const m = startMonth + i;
    const year = startYear + Math.floor((m - 1) / 12);
    const month = ((m - 1) % 12) + 1;
    months.push(`${year}-${String(month).padStart(2, "0")}`);
  }
  return months;
}

describe("computeScore", () => {
  it("returns null when insufficient data", () => {
    // Less than MIN_BASELINE_MONTHS (3) baseline + 2 recent
    const months = generateMonths(4);
    const metrics = months.map((m) => makeMonth(m));
    expect(computeScore(metrics)).toBeNull();
  });

  it("returns null for empty metrics", () => {
    expect(computeScore([])).toBeNull();
  });

  it("returns a score with enough data", () => {
    // Need at least 3 baseline + 2 recent = 5 months with activeDevs > 0
    // splitWindows: recent = last 6, baseline = everything before that
    // So we need at least 6 + 3 = 9 months
    const months = generateMonths(12);
    const metrics = months.map((m) => makeMonth(m));
    const result = computeScore(metrics);
    expect(result).not.toBeNull();
    expect(result!.score).toBeGreaterThanOrEqual(0);
    expect(result!.score).toBeLessThanOrEqual(100);
  });

  it("score has correct breakdown structure", () => {
    const months = generateMonths(12);
    const metrics = months.map((m) => makeMonth(m));
    const result = computeScore(metrics)!;
    expect(result.breakdown).toHaveProperty("throughput");
    expect(result.breakdown).toHaveProperty("slop");
    expect(result.breakdown).toHaveProperty("reviewAnomaly");
    expect(result.breakdown).toHaveProperty("consistency");
  });

  it("detects throughput surge when recent lines/dev increase", () => {
    const months = generateMonths(18);
    const metrics = months.map((m, i) =>
      makeMonth(m, {
        // Baseline months: normal output
        // Recent months (last 6): 3x output
        linesChangedPerDev: i >= 12 ? 1500 : 500,
        prMergeRatePerDev: i >= 12 ? 6 : 2,
      })
    );
    const result = computeScore(metrics)!;
    expect(result.breakdown.throughput).toBeGreaterThan(0);
  });

  it("detects slop signal when rejection rate increases", () => {
    const months = generateMonths(18);
    const metrics = months.map((m, i) =>
      makeMonth(m, {
        prRejectionRate: i >= 12 ? 0.4 : 0.1,
        firstTimeContribRatio: i >= 12 ? 0.3 : 0.05,
      })
    );
    const result = computeScore(metrics)!;
    expect(result.breakdown.slop).toBeGreaterThan(0);
  });

  it("reports low confidence with minimal baseline", () => {
    const months = generateMonths(9);
    const metrics = months.map((m) => makeMonth(m));
    const result = computeScore(metrics)!;
    expect(result.confidence).toBe("low");
  });

  it("reports high confidence with sufficient data", () => {
    const months = generateMonths(24);
    const metrics = months.map((m) => makeMonth(m));
    const result = computeScore(metrics)!;
    expect(result.confidence).toBe("high");
  });

  it("skips months with zero active devs", () => {
    const months = generateMonths(12);
    const metrics = months.map((m, i) =>
      makeMonth(m, { activeDevs: i % 3 === 0 ? 0 : 5 })
    );
    // With some zero-dev months filtered, may or may not have enough data
    const result = computeScore(metrics);
    // Should still be a valid result or null — never throws
    if (result) {
      expect(result.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("stable metrics yield low score (no AI signal)", () => {
    const months = generateMonths(18);
    // All months have identical metrics — no change = no AI signal
    const metrics = months.map((m) => makeMonth(m));
    const result = computeScore(metrics)!;
    expect(result.score).toBeLessThan(20);
  });

  it("score is clamped to 0-100 range", () => {
    const months = generateMonths(18);
    // Extreme values
    const metrics = months.map((m, i) =>
      makeMonth(m, {
        linesChangedPerDev: i >= 12 ? 50000 : 100,
        prMergeRatePerDev: i >= 12 ? 50 : 1,
        prRejectionRate: i >= 12 ? 0.9 : 0.01,
        firstTimeContribRatio: i >= 12 ? 0.8 : 0.01,
        medianTtmHours: i >= 12 ? 1 : 100,
      })
    );
    const result = computeScore(metrics)!;
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
