import { prisma } from "@/lib/db";
import { isBot } from "@/lib/github/client";
import type { MonthlyMetricResult } from "./types";

/**
 * Compute all 6 monthly velocity metrics for a project.
 *
 * Attribution rules:
 * - Lines changed: commits on default branch in month X
 * - PR merge rate: PRs merged in month X
 * - PR rejection rate: PRs closed-unmerged in month X / all closed in month X
 * - First-time contributor ratio: PRs opened in month X by first-time contributors
 * - Median time-to-merge: PRs merged in month X
 * - Median time-to-close (rejected): PRs closed-unmerged in month X
 *
 * Active dev: unique GitHub user with ≥1 commit on default branch OR ≥1 PR review that month.
 */
export async function computeMonthlyMetrics(
  projectId: string,
  month: string // YYYY-MM
): Promise<MonthlyMetricResult> {
  const monthStart = new Date(`${month}-01T00:00:00Z`);
  const nextMonth = new Date(monthStart);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);

  // 1. Get commits in this month (with file stats)
  const commits = await prisma.commit.findMany({
    where: {
      projectId,
      committedAt: { gte: monthStart, lt: nextMonth },
    },
    include: { fileStats: true },
  });

  // 2. Get PRs relevant to this month
  const mergedPRs = await prisma.pullRequest.findMany({
    where: {
      projectId,
      merged: true,
      mergedAt: { gte: monthStart, lt: nextMonth },
    },
  });

  const closedUnmergedPRs = await prisma.pullRequest.findMany({
    where: {
      projectId,
      merged: false,
      state: "closed",
      closedAt: { gte: monthStart, lt: nextMonth },
    },
  });

  const openedPRs = await prisma.pullRequest.findMany({
    where: {
      projectId,
      createdAt: { gte: monthStart, lt: nextMonth },
    },
  });

  // 3. Get reviews in this month
  const reviews = await prisma.pullRequestReview.findMany({
    where: {
      pullRequest: { projectId },
      submittedAt: { gte: monthStart, lt: nextMonth },
      state: { in: ["APPROVED", "CHANGES_REQUESTED", "COMMENTED"] },
    },
  });

  // 4. Calculate active developers
  const codeContributors = new Set<string>();
  for (const c of commits) {
    const login = c.authorLogin;
    if (login && !isBot(login)) codeContributors.add(login);
  }

  const reviewers = new Set<string>();
  for (const r of reviews) {
    if (!isBot(r.reviewerLogin)) reviewers.add(r.reviewerLogin);
  }

  const allActiveDevs = new Set([...codeContributors, ...reviewers]);
  const activeDevs = allActiveDevs.size;
  const activeCodeContributors = codeContributors.size;

  if (activeDevs === 0) {
    return {
      month,
      activeDevs: 0,
      activeCodeContributors: 0,
      linesChangedPerDev: null,
      prMergeRatePerDev: null,
      prRejectionRate: null,
      firstTimeContribRatio: null,
      medianTtmHours: null,
      medianTtcHours: null,
    };
  }

  // 5. Lines changed per active dev (using file stats, exclusions already applied at collection)
  let totalLinesChanged = 0;
  for (const commit of commits) {
    if (commit.authorLogin && isBot(commit.authorLogin)) continue;
    for (const stat of commit.fileStats) {
      totalLinesChanged += stat.additions + stat.deletions;
    }
  }
  const linesChangedPerDev = activeDevs > 0 ? totalLinesChanged / activeDevs : null;

  // 6. PR merge rate per active dev
  const nonBotMergedPRs = mergedPRs.filter((pr) => !isBot(pr.authorLogin));
  const prMergeRatePerDev =
    activeDevs > 0 ? nonBotMergedPRs.length / activeDevs : null;

  // 7. PR rejection rate
  const totalClosed = nonBotMergedPRs.length + closedUnmergedPRs.filter((pr) => !isBot(pr.authorLogin)).length;
  const nonBotRejected = closedUnmergedPRs.filter((pr) => !isBot(pr.authorLogin)).length;
  const prRejectionRate =
    totalClosed > 0 ? nonBotRejected / totalClosed : null;

  // 8. First-time contributor ratio
  let firstTimeCount = 0;
  const nonBotOpenedPRs = openedPRs.filter((pr) => !isBot(pr.authorLogin));
  for (const pr of nonBotOpenedPRs) {
    if (!pr.authorLogin) continue;
    // Check if this author had any PR before this one in this repo
    const priorPR = await prisma.pullRequest.findFirst({
      where: {
        projectId,
        authorLogin: pr.authorLogin,
        createdAt: { lt: pr.createdAt },
      },
    });
    if (!priorPR) firstTimeCount++;
  }
  const firstTimeContribRatio =
    nonBotOpenedPRs.length > 0 ? firstTimeCount / nonBotOpenedPRs.length : null;

  // 9. Median time-to-merge (hours)
  const ttmHours = nonBotMergedPRs
    .filter((pr) => pr.mergedAt)
    .map((pr) => {
      const diffMs = pr.mergedAt!.getTime() - pr.createdAt.getTime();
      return diffMs / (1000 * 60 * 60);
    })
    .sort((a, b) => a - b);
  const medianTtmHours = median(ttmHours);

  // 10. Median time-to-close (rejected)
  const ttcHours = closedUnmergedPRs
    .filter((pr) => pr.closedAt && !isBot(pr.authorLogin))
    .map((pr) => {
      const diffMs = pr.closedAt!.getTime() - pr.createdAt.getTime();
      return diffMs / (1000 * 60 * 60);
    })
    .sort((a, b) => a - b);
  const medianTtcHours = median(ttcHours);

  return {
    month,
    activeDevs,
    activeCodeContributors,
    linesChangedPerDev,
    prMergeRatePerDev,
    prRejectionRate,
    firstTimeContribRatio,
    medianTtmHours,
    medianTtcHours,
  };
}

function median(sorted: number[]): number | null {
  if (sorted.length === 0) return null;
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Compute and persist metrics for all months with data for a project.
 */
export async function computeAndStoreMetrics(
  projectId: string
): Promise<MonthlyMetricResult[]> {
  // Find the date range of commits
  const earliest = await prisma.commit.findFirst({
    where: { projectId },
    orderBy: { committedAt: "asc" },
  });
  const latest = await prisma.commit.findFirst({
    where: { projectId },
    orderBy: { committedAt: "desc" },
  });

  if (!earliest || !latest) return [];

  // Generate all months in range
  const months: string[] = [];
  const start = new Date(earliest.committedAt);
  const end = new Date(latest.committedAt);
  const cursor = new Date(start.getUTCFullYear(), start.getUTCMonth(), 1);

  while (cursor <= end) {
    const y = cursor.getUTCFullYear();
    const m = String(cursor.getUTCMonth() + 1).padStart(2, "0");
    months.push(`${y}-${m}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  const results: MonthlyMetricResult[] = [];

  for (const month of months) {
    const metric = await computeMonthlyMetrics(projectId, month);
    results.push(metric);

    // Persist
    await prisma.monthlyMetric.upsert({
      where: {
        projectId_month_metricVersion: {
          projectId,
          month,
          metricVersion: 1,
        },
      },
      update: {
        activeDevs: metric.activeDevs,
        activeCodeContributors: metric.activeCodeContributors,
        linesChangedPerDev: metric.linesChangedPerDev,
        prMergeRatePerDev: metric.prMergeRatePerDev,
        prRejectionRate: metric.prRejectionRate,
        firstTimeContribRatio: metric.firstTimeContribRatio,
        medianTtmHours: metric.medianTtmHours,
        medianTtcHours: metric.medianTtcHours,
        computedAt: new Date(),
      },
      create: {
        projectId,
        month,
        activeDevs: metric.activeDevs,
        activeCodeContributors: metric.activeCodeContributors,
        linesChangedPerDev: metric.linesChangedPerDev,
        prMergeRatePerDev: metric.prMergeRatePerDev,
        prRejectionRate: metric.prRejectionRate,
        firstTimeContribRatio: metric.firstTimeContribRatio,
        medianTtmHours: metric.medianTtmHours,
        medianTtcHours: metric.medianTtcHours,
      },
    });
  }

  return results;
}
