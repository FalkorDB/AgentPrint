import { prisma } from "@/lib/db";
import { fetchPullRequests, fetchPRReviews } from "@/lib/github/pulls";
import { fetchCommits } from "@/lib/github/commits";
import { getFileChanges } from "./git-clone";
import { isBot, getOctokit } from "@/lib/github/client";

export interface CollectionResult {
  projectId: string;
  commitsCollected: number;
  prsCollected: number;
  reviewsCollected: number;
  fileStatsCollected: number;
}

/**
 * Collect all raw data for a project from GitHub API + git clone.
 * Supports incremental sync using RepoSyncState.
 */
export async function collectProjectData(
  projectId: string
): Promise<CollectionResult> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { syncState: true },
  });

  const { owner, repo } = project;
  const syncState = project.syncState;

  // Auto-detect and update the default branch from GitHub
  let defaultBranch = project.defaultBranch;
  try {
    const octokit = getOctokit();
    const { data } = await octokit.rest.repos.get({ owner, repo });
    defaultBranch = data.default_branch;
    if (defaultBranch !== project.defaultBranch) {
      await prisma.project.update({
        where: { id: projectId },
        data: { defaultBranch },
      });
    }
  } catch {
    // Keep stored value if API call fails
  }

  const sinceDate = syncState?.lastCommitDate ?? undefined;
  const lastSha = syncState?.lastCommitSha ?? undefined;

  // 1. Fetch commits from GitHub API (for author login mapping)
  const apiCommits = await fetchCommits({
    owner,
    repo,
    sha: defaultBranch,
    since: sinceDate,
  });

  // Build sha → login map for identity resolution
  const shaToLogin = new Map<string, string>();
  for (const c of apiCommits) {
    if (c.authorLogin && !isBot(c.authorLogin)) {
      shaToLogin.set(c.sha, c.authorLogin);
    }
  }

  // 2. Get per-file changes from git clone (for accurate line counts with exclusions)
  const fileChanges = await getFileChanges(
    owner,
    repo,
    defaultBranch,
    sinceDate,
    lastSha ?? undefined
  );

  // 3. Fetch PRs
  const prs = await fetchPullRequests({
    owner,
    repo,
    state: "all",
    since: syncState?.lastPrUpdatedAt ?? undefined,
  });

  // 4. Persist commits + file stats
  let commitsCollected = 0;
  let fileStatsCollected = 0;

  // Group file changes by sha
  const changesBySha = new Map<string, typeof fileChanges>();
  for (const fc of fileChanges) {
    const existing = changesBySha.get(fc.sha) || [];
    existing.push(fc);
    changesBySha.set(fc.sha, existing);
  }

  for (const [sha, files] of changesBySha) {
    const apiCommit = apiCommits.find((c) => c.sha === sha);
    const authorLogin = shaToLogin.get(sha) ?? null;

    try {
      const commit = await prisma.commit.upsert({
        where: {
          projectId_sha: { projectId, sha },
        },
        update: {
          authorLogin: authorLogin ?? undefined,
        },
        create: {
          projectId,
          sha,
          authorLogin,
          authorEmail: apiCommit?.authorEmail ?? files[0]?.authorEmail ?? null,
          authorName: apiCommit?.authorName ?? files[0]?.authorName ?? null,
          message: apiCommit?.message ?? null,
          committedAt: apiCommit?.committedAt ?? files[0]?.date ?? new Date(),
        },
      });

      // Upsert file stats
      for (const file of files) {
        await prisma.commitFileStat.create({
          data: {
            commitId: commit.id,
            path: file.path,
            additions: file.additions,
            deletions: file.deletions,
          },
        });
        fileStatsCollected++;
      }

      commitsCollected++;
    } catch {
      // Skip duplicate commits
    }
  }

  // 5. Persist PRs
  let prsCollected = 0;
  for (const pr of prs) {
    try {
      await prisma.pullRequest.upsert({
        where: {
          projectId_number: { projectId, number: pr.number },
        },
        update: {
          state: pr.state,
          merged: pr.merged,
          mergedAt: pr.mergedAt,
          closedAt: pr.closedAt,
        },
        create: {
          projectId,
          number: pr.number,
          authorLogin: pr.authorLogin,
          title: pr.title,
          state: pr.state,
          merged: pr.merged,
          createdAt: pr.createdAt,
          mergedAt: pr.mergedAt,
          closedAt: pr.closedAt,
        },
      });
      prsCollected++;
    } catch {
      // Skip errors
    }
  }

  // 6. Fetch and persist reviews for new/updated PRs
  let reviewsCollected = 0;
  for (const pr of prs) {
    const reviews = await fetchPRReviews(owner, repo, pr.number);
    for (const review of reviews) {
      try {
        const prRecord = await prisma.pullRequest.findUnique({
          where: { projectId_number: { projectId, number: pr.number } },
        });
        if (!prRecord) continue;

        await prisma.pullRequestReview.create({
          data: {
            pullRequestId: prRecord.id,
            reviewerLogin: review.reviewerLogin,
            state: review.state,
            submittedAt: review.submittedAt,
          },
        });
        reviewsCollected++;
      } catch {
        // Skip duplicates
      }
    }
  }

  // 7. Update sync state
  const latestCommitDate =
    apiCommits.length > 0
      ? apiCommits.reduce((latest, c) =>
          c.committedAt > latest.committedAt ? c : latest
        ).committedAt
      : syncState?.lastCommitDate;

  const latestCommitSha =
    apiCommits.length > 0 ? apiCommits[0].sha : syncState?.lastCommitSha;

  const latestPrUpdatedAt =
    prs.length > 0
      ? prs.reduce((latest, p) => {
          const d = p.closedAt ?? p.mergedAt ?? p.createdAt;
          return d > latest ? d : latest;
        }, new Date(0))
      : syncState?.lastPrUpdatedAt;

  await prisma.repoSyncState.upsert({
    where: { projectId },
    update: {
      lastCommitSha: latestCommitSha,
      lastCommitDate: latestCommitDate,
      lastPrUpdatedAt: latestPrUpdatedAt,
      lastSyncAt: new Date(),
    },
    create: {
      projectId,
      lastCommitSha: latestCommitSha,
      lastCommitDate: latestCommitDate,
      lastPrUpdatedAt: latestPrUpdatedAt,
      lastSyncAt: new Date(),
    },
  });

  return {
    projectId,
    commitsCollected,
    prsCollected,
    reviewsCollected,
    fileStatsCollected,
  };
}
