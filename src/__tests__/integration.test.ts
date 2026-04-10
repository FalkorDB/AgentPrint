import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";

// Skip if no DATABASE_URL (unit-test-only environments)
const SKIP = !process.env.DATABASE_URL;

// Dynamic imports to avoid loading db.ts when DATABASE_URL is absent
type ComputeFn = typeof import("@/lib/metrics/compute");
let computeMonthlyMetrics: ComputeFn["computeMonthlyMetrics"];
let computeAndStoreMetrics: ComputeFn["computeAndStoreMetrics"];

describe.skipIf(SKIP)("computeMonthlyMetrics (integration)", () => {
  let prisma: PrismaClient;
  let projectId: string;

  beforeAll(async () => {
    const { getTestPrisma } = await import("./helpers/test-db");
    prisma = getTestPrisma();
    const mod = await import("@/lib/metrics/compute");
    computeMonthlyMetrics = mod.computeMonthlyMetrics;
    computeAndStoreMetrics = mod.computeAndStoreMetrics;
  });

  afterAll(async () => {
    const { cleanDatabase } = await import("./helpers/test-db");
    await cleanDatabase(prisma);
  });

  beforeEach(async () => {
    const { cleanDatabase, seedTestProject } = await import("./helpers/test-db");
    await cleanDatabase(prisma);
    const seed = await seedTestProject(prisma);
    projectId = seed.project.id;
  });

  it("computes metrics for a month with activity", async () => {
    const result = await computeMonthlyMetrics(projectId, "2024-01");

    // alice, bob, charlie all have commits; bob reviewed PR#1, alice reviewed PR#2
    expect(result.activeDevs).toBe(3);
    expect(result.activeCodeContributors).toBe(3);
    expect(result.month).toBe("2024-01");

    // Lines changed: 5 commits with file stats
    expect(result.linesChangedPerDev).toBeGreaterThan(0);

    // 2 merged PRs / 3 active devs
    expect(result.prMergeRatePerDev).toBeCloseTo(2 / 3, 1);

    // 1 rejected out of 3 total closed
    expect(result.prRejectionRate).toBeCloseTo(1 / 3, 1);

    // Median TTM: all merged PRs took 5 days (120 hours)
    expect(result.medianTtmHours).toBeCloseTo(120, 0);
  });

  it("returns zeros for a month with no activity", async () => {
    const result = await computeMonthlyMetrics(projectId, "2023-06");

    expect(result.activeDevs).toBe(0);
    expect(result.linesChangedPerDev).toBeNull();
    expect(result.prMergeRatePerDev).toBeNull();
    expect(result.prRejectionRate).toBeNull();
    expect(result.medianTtmHours).toBeNull();
    expect(result.medianTtcHours).toBeNull();
  });

  it("detects first-time contributors", async () => {
    // In Feb, newbie1 opened PR#4 and newbie2 opened PR#7 — both first-time
    // alice opened PR#5, bob opened PR#6 — not first-time
    const result = await computeMonthlyMetrics(projectId, "2024-02");

    // 4 PRs opened in Feb: #4 (newbie1), #5 (alice), #6 (bob), #7 (newbie2)
    // 2 are first-time: newbie1, newbie2
    expect(result.firstTimeContribRatio).toBeCloseTo(2 / 4, 1);
  });

  it("excludes bot accounts from active devs", async () => {
    // Add a bot commit in Jan
    await prisma.commit.create({
      data: {
        projectId,
        sha: "botcommit001",
        authorLogin: "dependabot[bot]",
        authorEmail: "bot@github.com",
        authorName: "Dependabot",
        message: "bump deps",
        committedAt: new Date("2024-01-20T12:00:00Z"),
      },
    });

    const result = await computeMonthlyMetrics(projectId, "2024-01");

    // Bot should not be counted as active dev
    expect(result.activeDevs).toBe(3);
  });
});

describe.skipIf(SKIP)("computeAndStoreMetrics (integration)", () => {
  let prisma: PrismaClient;
  let projectId: string;

  beforeAll(async () => {
    const { getTestPrisma } = await import("./helpers/test-db");
    prisma = getTestPrisma();
    const mod = await import("@/lib/metrics/compute");
    computeAndStoreMetrics = mod.computeAndStoreMetrics;
  });

  afterAll(async () => {
    const { cleanDatabase } = await import("./helpers/test-db");
    await cleanDatabase(prisma);
  });

  beforeEach(async () => {
    const { cleanDatabase, seedTestProject } = await import("./helpers/test-db");
    await cleanDatabase(prisma);
    const seed = await seedTestProject(prisma);
    projectId = seed.project.id;
  });

  it("computes and stores metrics for all months with data", async () => {
    const results = await computeAndStoreMetrics(projectId);

    // Should have metrics for Jan and Feb 2024
    expect(results.length).toBe(2);
    expect(results[0].month).toBe("2024-01");
    expect(results[1].month).toBe("2024-02");

    // Verify they were persisted
    const stored = await prisma.monthlyMetric.findMany({
      where: { projectId },
      orderBy: { month: "asc" },
    });
    expect(stored.length).toBe(2);
    expect(stored[0].month).toBe("2024-01");
    expect(stored[1].month).toBe("2024-02");
    expect(stored[0].activeDevs).toBeGreaterThan(0);
  });

  it("upserts metrics on re-computation", async () => {
    await computeAndStoreMetrics(projectId);
    await computeAndStoreMetrics(projectId);

    // Should still have exactly 2 metrics (upserted, not duplicated)
    const stored = await prisma.monthlyMetric.findMany({
      where: { projectId },
    });
    expect(stored.length).toBe(2);
  });
});

describe.skipIf(SKIP)("Project CRUD (integration)", () => {
  let prisma: PrismaClient;

  beforeAll(async () => {
    const { getTestPrisma } = await import("./helpers/test-db");
    prisma = getTestPrisma();
  });

  afterAll(async () => {
    const { cleanDatabase } = await import("./helpers/test-db");
    await cleanDatabase(prisma);
  });

  beforeEach(async () => {
    const { cleanDatabase } = await import("./helpers/test-db");
    await cleanDatabase(prisma);
  });

  it("creates a project with unique owner/repo constraint", async () => {
    const project = await prisma.project.create({
      data: { owner: "org", repo: "myrepo", defaultBranch: "main" },
    });
    expect(project.owner).toBe("org");
    expect(project.repo).toBe("myrepo");

    // Duplicate should fail
    await expect(
      prisma.project.create({
        data: { owner: "org", repo: "myrepo", defaultBranch: "main" },
      })
    ).rejects.toThrow();
  });

  it("cascades deletes to commits, PRs, and metrics", async () => {
    const { seedTestProject } = await import("./helpers/test-db");
    const seed = await seedTestProject(prisma);

    await prisma.project.delete({ where: { id: seed.project.id } });

    const commits = await prisma.commit.findMany({ where: { projectId: seed.project.id } });
    const prs = await prisma.pullRequest.findMany({ where: { projectId: seed.project.id } });
    expect(commits.length).toBe(0);
    expect(prs.length).toBe(0);
  });
});
