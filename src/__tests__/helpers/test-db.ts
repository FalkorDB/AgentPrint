import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { execSync } from "child_process";

let testPrisma: PrismaClient | null = null;

/**
 * Get a Prisma client connected to the test database.
 * Runs migrations on first call.
 */
export function getTestPrisma(): PrismaClient {
  if (testPrisma) return testPrisma;

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must be set for integration tests");
  }

  // Run migrations
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  });

  const adapter = new PrismaPg({ connectionString: url });
  testPrisma = new PrismaClient({ adapter }) as unknown as PrismaClient;
  return testPrisma;
}

/**
 * Clean all data from the database (preserves schema).
 */
export async function cleanDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.pullRequestReview.deleteMany();
  await prisma.commitFileStat.deleteMany();
  await prisma.monthlyMetric.deleteMany();
  await prisma.repoSyncState.deleteMany();
  await prisma.pullRequest.deleteMany();
  await prisma.commit.deleteMany();
  await prisma.project.deleteMany();
}

/**
 * Seed a project with commits, PRs, reviews, and file stats for testing.
 */
export async function seedTestProject(prisma: PrismaClient) {
  const project = await prisma.project.create({
    data: {
      owner: "test-org",
      repo: "test-repo",
      defaultBranch: "main",
    },
  });

  const commits = [];
  for (let i = 0; i < 10; i++) {
    const month = i < 5 ? "2024-01" : "2024-02";
    const day = (i % 28) + 1;
    const commit = await prisma.commit.create({
      data: {
        projectId: project.id,
        sha: `abc${i.toString().padStart(6, "0")}`,
        authorLogin: i % 3 === 0 ? "alice" : i % 3 === 1 ? "bob" : "charlie",
        authorEmail: `dev${i}@test.com`,
        authorName: `Dev ${i}`,
        message: `commit ${i}`,
        committedAt: new Date(`${month}-${String(day).padStart(2, "0")}T12:00:00Z`),
      },
    });
    commits.push(commit);

    await prisma.commitFileStat.create({
      data: {
        commitId: commit.id,
        path: `src/file${i}.ts`,
        additions: 50 + i * 10,
        deletions: 10 + i * 5,
      },
    });
  }

  const prData = [
    { number: 1, author: "alice", state: "closed", merged: true, month: "2024-01" },
    { number: 2, author: "bob", state: "closed", merged: true, month: "2024-01" },
    { number: 3, author: "charlie", state: "closed", merged: false, month: "2024-01" },
    { number: 4, author: "newbie1", state: "closed", merged: true, month: "2024-02" },
    { number: 5, author: "alice", state: "closed", merged: true, month: "2024-02" },
    { number: 6, author: "bob", state: "closed", merged: false, month: "2024-02" },
    { number: 7, author: "newbie2", state: "open", merged: false, month: "2024-02" },
  ];

  const prs = [];
  for (const pr of prData) {
    const createdAt = new Date(`${pr.month}-10T10:00:00Z`);
    const closedAt = pr.state === "closed" ? new Date(`${pr.month}-15T10:00:00Z`) : null;
    const mergedAt = pr.merged ? closedAt : null;

    const record = await prisma.pullRequest.create({
      data: {
        projectId: project.id,
        number: pr.number,
        authorLogin: pr.author,
        title: `PR #${pr.number}`,
        state: pr.state,
        merged: pr.merged,
        createdAt,
        mergedAt,
        closedAt,
      },
    });
    prs.push(record);
  }

  await prisma.pullRequestReview.create({
    data: {
      pullRequestId: prs[0].id,
      reviewerLogin: "bob",
      state: "APPROVED",
      submittedAt: new Date("2024-01-12T10:00:00Z"),
    },
  });
  await prisma.pullRequestReview.create({
    data: {
      pullRequestId: prs[1].id,
      reviewerLogin: "alice",
      state: "APPROVED",
      submittedAt: new Date("2024-01-13T10:00:00Z"),
    },
  });
  await prisma.pullRequestReview.create({
    data: {
      pullRequestId: prs[3].id,
      reviewerLogin: "charlie",
      state: "APPROVED",
      submittedAt: new Date("2024-02-12T10:00:00Z"),
    },
  });

  return { project, commits, prs };
}
