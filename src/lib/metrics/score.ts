import { prisma } from "@/lib/db";

interface MonthData {
  month: string;
  activeDevs: number;
  activeCodeContributors: number;
  linesChangedPerDev: number | null;
  prMergeRatePerDev: number | null;
  prRejectionRate: number | null;
  firstTimeContribRatio: number | null;
  medianTtmHours: number | null;
  medianTtcHours: number | null;
}

export interface ScoreResult {
  score: number;
  confidence: "low" | "medium" | "high";
  breakdown: {
    throughput: number;   // 0-25
    slop: number;         // 0-40
    reviewAnomaly: number; // 0-20
    consistency: number;   // 0-15
  };
}

const RECENT_MONTHS = 6;
const BASELINE_START = 6;
const BASELINE_END = 18;
const MIN_BASELINE_MONTHS = 3;
const MIN_PRS_FOR_RATIOS = 5;

function median(arr: number[]): number | null {
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Split metrics into recent and baseline windows.
 * Only includes months with active devs > 0.
 */
function splitWindows(metrics: MonthData[]): { recent: MonthData[]; baseline: MonthData[] } {
  const active = metrics.filter((m) => m.activeDevs > 0);
  if (active.length === 0) return { recent: [], baseline: [] };

  const recent = active.slice(-RECENT_MONTHS);
  const remainingForBaseline = active.slice(0, -RECENT_MONTHS);
  const baseline = remainingForBaseline.slice(-BASELINE_END + BASELINE_START);

  return { recent, baseline };
}

/**
 * Compute the Agent Impact Score for a project.
 *
 * Score components:
 * 1. Throughput surge (0-25): Combined lines/dev + PR rate/dev growth
 * 2. Slop signal (0-40): Rejection rate + first-time contributor ratio increase
 * 3. Review anomaly (0-20): TTM decrease while volume grows
 * 4. Consistency (0-15): How many recent months show the pattern
 */
export function computeScore(metrics: MonthData[]): ScoreResult | null {
  const { recent, baseline } = splitWindows(metrics);

  if (baseline.length < MIN_BASELINE_MONTHS || recent.length < 2) {
    return null;
  }

  const confidence: "low" | "medium" | "high" =
    baseline.length >= 9 && recent.length >= 5 ? "high" :
    baseline.length >= 6 ? "medium" : "low";

  // Use activeCodeContributors for code-output signals
  const recentLinesPerDev = recent
    .filter((m) => m.linesChangedPerDev !== null && m.activeCodeContributors > 0)
    .map((m) => m.linesChangedPerDev!);
  const baselineLinesPerDev = baseline
    .filter((m) => m.linesChangedPerDev !== null && m.activeCodeContributors > 0)
    .map((m) => m.linesChangedPerDev!);

  const recentPrRate = recent
    .filter((m) => m.prMergeRatePerDev !== null)
    .map((m) => m.prMergeRatePerDev!);
  const baselinePrRate = baseline
    .filter((m) => m.prMergeRatePerDev !== null)
    .map((m) => m.prMergeRatePerDev!);

  // --- 1. Throughput surge (0-25) ---
  const medRecentLines = median(recentLinesPerDev);
  const medBaselineLines = median(baselineLinesPerDev);
  const medRecentPr = median(recentPrRate);
  const medBaselinePr = median(baselinePrRate);

  let throughput = 0;
  if (medBaselineLines && medRecentLines && medBaselineLines > 0) {
    const linesGrowth = (medRecentLines / medBaselineLines - 1);
    throughput += clamp(linesGrowth * 30, 0, 15);
  }
  if (medBaselinePr && medRecentPr && medBaselinePr > 0) {
    const prGrowth = (medRecentPr / medBaselinePr - 1);
    throughput += clamp(prGrowth * 25, 0, 10);
  }
  throughput = clamp(throughput, 0, 25);

  // --- 2. Slop signal (0-40) ---
  // Only use months with enough PR activity for meaningful ratios
  const recentRejection = recent
    .filter((m) => m.prRejectionRate !== null)
    .map((m) => m.prRejectionRate!);
  const baselineRejection = baseline
    .filter((m) => m.prRejectionRate !== null)
    .map((m) => m.prRejectionRate!);
  const recentFirstTime = recent
    .filter((m) => m.firstTimeContribRatio !== null)
    .map((m) => m.firstTimeContribRatio!);
  const baselineFirstTime = baseline
    .filter((m) => m.firstTimeContribRatio !== null)
    .map((m) => m.firstTimeContribRatio!);

  let slop = 0;
  const medRecentRej = median(recentRejection);
  const medBaselineRej = median(baselineRejection);
  if (medRecentRej !== null && medBaselineRej !== null &&
      recentRejection.length >= MIN_PRS_FOR_RATIOS) {
    const rejDelta = medRecentRej - medBaselineRej;
    slop += clamp(rejDelta * 100, 0, 20);
  }

  const medRecentFT = median(recentFirstTime);
  const medBaselineFT = median(baselineFirstTime);
  if (medRecentFT !== null && medBaselineFT !== null) {
    const ftDelta = medRecentFT - medBaselineFT;
    slop += clamp(ftDelta * 100, 0, 20);
  }
  slop = clamp(slop, 0, 40);

  // --- 3. Review anomaly (0-20) ---
  // TTM decreasing while volume grows = possible rubber-stamping
  const recentTTM = recent
    .filter((m) => m.medianTtmHours !== null)
    .map((m) => m.medianTtmHours!);
  const baselineTTM = baseline
    .filter((m) => m.medianTtmHours !== null)
    .map((m) => m.medianTtmHours!);

  let reviewAnomaly = 0;
  const medRecentTTM = median(recentTTM);
  const medBaselineTTM = median(baselineTTM);
  if (medRecentTTM !== null && medBaselineTTM !== null && medBaselineTTM > 0) {
    const ttmChange = (medBaselineTTM - medRecentTTM) / medBaselineTTM; // positive = faster
    const volumeGrew = throughput > 5;
    if (ttmChange > 0 && volumeGrew) {
      reviewAnomaly += clamp(ttmChange * 40, 0, 15);
    }
  }

  // Reviewer/committer gap: more reviewers-only relative to committers
  const recentReviewerRatio = recent
    .filter((m) => m.activeDevs > 0)
    .map((m) => (m.activeDevs - m.activeCodeContributors) / m.activeDevs);
  const baselineReviewerRatio = baseline
    .filter((m) => m.activeDevs > 0)
    .map((m) => (m.activeDevs - m.activeCodeContributors) / m.activeDevs);
  const medRecentRevRatio = median(recentReviewerRatio);
  const medBaselineRevRatio = median(baselineReviewerRatio);
  if (medRecentRevRatio !== null && medBaselineRevRatio !== null) {
    const revDelta = medRecentRevRatio - medBaselineRevRatio;
    if (revDelta > 0) {
      reviewAnomaly += clamp(revDelta * 30, 0, 5);
    }
  }
  reviewAnomaly = clamp(reviewAnomaly, 0, 20);

  // --- 4. Consistency (0-15) ---
  // How many recent months individually show the pattern?
  let consistentMonths = 0;
  for (const m of recent) {
    let signals = 0;
    if (medBaselineLines && m.linesChangedPerDev && m.linesChangedPerDev > medBaselineLines * 1.2) signals++;
    if (medBaselineRej !== null && m.prRejectionRate !== null && m.prRejectionRate > medBaselineRej) signals++;
    if (medBaselineFT !== null && m.firstTimeContribRatio !== null && m.firstTimeContribRatio > medBaselineFT) signals++;
    if (signals >= 2) consistentMonths++;
  }
  const consistency = clamp((consistentMonths / recent.length) * 15, 0, 15);

  const score = Math.round(clamp(throughput + slop + reviewAnomaly + consistency, 0, 100));

  return {
    score,
    confidence,
    breakdown: {
      throughput: Math.round(throughput * 10) / 10,
      slop: Math.round(slop * 10) / 10,
      reviewAnomaly: Math.round(reviewAnomaly * 10) / 10,
      consistency: Math.round(consistency * 10) / 10,
    },
  };
}

/**
 * Compute and store the Agent Impact Score for a project.
 */
export async function computeAndStoreScore(projectId: string): Promise<ScoreResult | null> {
  const metrics = await prisma.monthlyMetric.findMany({
    where: { projectId },
    orderBy: { month: "asc" },
  });

  const result = computeScore(metrics);

  await prisma.project.update({
    where: { id: projectId },
    data: {
      impactScore: result?.score ?? null,
      impactConfidence: result?.confidence ?? null,
      impactScoreVersion: 1,
      impactScoreComputedAt: new Date(),
    },
  });

  return result;
}
