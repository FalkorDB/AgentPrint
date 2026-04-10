import { prisma } from "@/lib/db";
import { fetchPullRequests, fetchPRReviews } from "@/lib/github/pulls";
import { fetchCommits } from "@/lib/github/commits";
import { getFileChanges } from "./git-clone";
import { isBot, getOctokit, setRateLimitNotify } from "@/lib/github/client";
import { fetchStarHistory } from "@/lib/github/stars";

export interface CollectionResult {
  projectId: string;
  commitsCollected: number;
  prsCollected: number;
  reviewsCollected: number;
  fileStatsCollected: number;
}

export type ProgressCallback = (step: string, detail?: string) => void;

/**
 * Collect all raw data for a project from GitHub API + git clone.
 * Supports incremental sync using RepoSyncState.
 */
export async function collectProjectData(
  projectId: string,
  onProgress?: ProgressCallback
): Promise<CollectionResult> {
  const progress = onProgress ?? (() => {});

  // Wire rate-limit notifications into the progress stream
  setRateLimitNotify((msg) => progress("⏳ Rate limit", msg));

  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { syncState: true },
  });

  const { owner, repo } = project;
  const syncState = project.syncState;

  // Auto-detect and update the default branch from GitHub
  progress("Detecting default branch…");
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
  progress("Detected branch", defaultBranch);

  const sinceDate = syncState?.lastCommitDate ?? undefined;
  const lastSha = syncState?.lastCommitSha ?? undefined;

  // 1. Fetch commits from GitHub API (for author login mapping)
  progress("Fetching commits from GitHub API…");
  const apiCommits = await fetchCommits({
    owner,
    repo,
    sha: defaultBranch,
    since: sinceDate,
  });
  progress("Commits fetched", `${apiCommits.length} commits`);

  // Build sha → login map for identity resolution
  const shaToLogin = new Map<string, string>();
  for (const c of apiCommits) {
    if (c.authorLogin && !isBot(c.authorLogin)) {
      shaToLogin.set(c.sha, c.authorLogin);
    }
  }

  // 2. Get per-file changes from GitHub API (for accurate line counts with exclusions)
  progress("Fetching per-file change stats…", "0 commits");
  const fileChanges = await getFileChanges(
    owner,
    repo,
    defaultBranch,
    sinceDate,
    lastSha ?? undefined,
    (done, total) => progress("Fetching per-file change stats…", `${done}/${total} commits`)
  );
  progress("File changes analyzed", `${fileChanges.length} file changes`);

  // 3. Fetch PRs
  progress("Fetching pull requests…");
  const prs = await fetchPullRequests({
    owner,
    repo,
    state: "all",
    since: syncState?.lastPrUpdatedAt ?? undefined,
  });
  progress("Pull requests fetched", `${prs.length} PRs`);

  // 4. Persist commits + file stats
  progress("Storing commits & file stats…");
  let commitsCollected = 0;
  let fileStatsCollected = 0;

  // Group file changes by sha
  const changesBySha = new Map<string, typeof fileChanges>();
  for (const fc of fileChanges) {
    const existing = changesBySha.get(fc.sha) || [];
    existing.push(fc);
    changesBySha.set(fc.sha, existing);
  }

  const totalCommits = changesBySha.size;
  let commitIdx = 0;
  for (const [sha, files] of changesBySha) {
    commitIdx++;
    progress("Storing commits & file stats…", `${commitIdx}/${totalCommits}`);
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
  progress("Commits stored", `${commitsCollected} commits, ${fileStatsCollected} file stats`);

  // 5. Persist PRs
  progress("Storing pull requests…");
  let prsCollected = 0;
  for (let pi = 0; pi < prs.length; pi++) {
    const pr = prs[pi];
    progress("Storing pull requests…", `${pi + 1}/${prs.length}`);
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
  progress("PRs stored", `${prsCollected} PRs`);

  // 6. Fetch and persist reviews for new/updated PRs
  let reviewsCollected = 0;
  let reviewErrors = 0;
  for (let i = 0; i < prs.length; i++) {
    const pr = prs[i];
    progress("Fetching reviews…", `PR #${pr.number} (${i + 1}/${prs.length})`);
    let reviews;
    try {
      reviews = await fetchPRReviews(owner, repo, pr.number);
    } catch (err) {
      reviewErrors++;
      const msg = err instanceof Error ? err.message : String(err);
      progress("⚠ Review fetch failed", `PR #${pr.number}: ${msg}`);
      continue;
    }
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
  progress(
    "Reviews stored",
    `${reviewsCollected} reviews${reviewErrors > 0 ? ` (${reviewErrors} PRs skipped due to errors)` : ""}`
  );

  // 7. Fetch and store star history
  progress("Fetching star history…");
  try {
    const { history, totalStars } = await fetchStarHistory(
      owner,
      repo,
      (detail) => progress("Fetching star history…", detail)
    );
    for (const point of history) {
      await prisma.starHistory.upsert({
        where: { projectId_month: { projectId, month: point.month } },
        update: { cumulativeStars: point.cumulativeStars },
        create: { projectId, month: point.month, cumulativeStars: point.cumulativeStars },
      });
    }
    await prisma.project.update({
      where: { id: projectId },
      data: { githubStars: totalStars },
    });
    progress("Star history stored", `${history.length} months, ${totalStars} total stars`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    progress("⚠ Star history failed", msg);
  }

  // 8. Update sync state
  progress("Updating sync state…");
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

  // Update cached GitHub stats with accurate DB counts
  const [commitCount, prCount] = await Promise.all([
    prisma.commit.count({ where: { projectId } }),
    prisma.pullRequest.count({ where: { projectId } }),
  ]);
  await prisma.project.update({
    where: { id: projectId },
    data: { githubCommitCount: commitCount, githubPrCount: prCount },
  });

  // Detach rate-limit callback
  setRateLimitNotify(null);

  return {
    projectId,
    commitsCollected,
    prsCollected,
    reviewsCollected,
    fileStatsCollected,
  };
}
