import { prisma } from "@/lib/db";
import { fetchPullRequests, fetchPRReviews } from "@/lib/github/pulls";
import { fetchCommits } from "@/lib/github/commits";
import { getFileChanges } from "./git-clone";
import { isBot, getOctokit, setRateLimitNotify, GitHubRateLimitError, asRateLimitError } from "@/lib/github/client";
import { fetchStarHistory } from "@/lib/github/stars";

export interface CollectionResult {
  projectId: string;
  commitsCollected: number;
  prsCollected: number;
  reviewsCollected: number;
  fileStatsCollected: number;
  /** True if any step was cut short by rate limiting */
  rateLimited: boolean;
}

export type ProgressCallback = (step: string, detail?: string) => void;

/**
 * Collect all raw data for a project from GitHub API + git clone.
 * Supports incremental sync using RepoSyncState.
 * Saves partial sync state even when rate limited, so retries resume.
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

  let commitsCollected = 0;
  let fileStatsCollected = 0;
  let prsCollected = 0;
  let reviewsCollected = 0;
  let wasRateLimited = false;

  // Track data for sync state saving (even on partial completion)
  let apiCommits: Awaited<ReturnType<typeof fetchCommits>>["commits"] = [];
  let prs: Awaited<ReturnType<typeof fetchPullRequests>>["prs"] = [];

  try {
    // 1. Fetch commits from GitHub API (for author login mapping)
    progress("Fetching commits from GitHub API…");
    const commitResult = await fetchCommits({
      owner,
      repo,
      sha: defaultBranch,
      since: sinceDate,
    });
    apiCommits = commitResult.commits;
    if (commitResult.rateLimited) {
      wasRateLimited = true;
      progress("⚠ Rate limited", commitResult.rateLimitMessage);
    }
    progress("Commits fetched", `${apiCommits.length} commits${commitResult.rateLimited ? " (partial)" : ""}`);

    // Build sha → login map for identity resolution
    const shaToLogin = new Map<string, string>();
    for (const c of apiCommits) {
      if (c.authorLogin && !isBot(c.authorLogin)) {
        shaToLogin.set(c.sha, c.authorLogin);
      }
    }

    // 2. Get per-file changes from GitHub API
    progress("Fetching per-file change stats…", "0 commits");
    const fileResult = await getFileChanges(
      owner,
      repo,
      defaultBranch,
      sinceDate,
      lastSha ?? undefined,
      (done, total) => progress("Fetching per-file change stats…", `${done}/${total} commits`)
    );
    const fileChanges = fileResult.changes;
    if (fileResult.rateLimited) {
      wasRateLimited = true;
      progress("⚠ Rate limited", fileResult.rateLimitMessage);
    }
    progress("File changes analyzed", `${fileChanges.length} file changes${fileResult.rateLimited ? " (partial)" : ""}`);

    // 3. Fetch PRs
    progress("Fetching pull requests…");
    const prResult = await fetchPullRequests({
      owner,
      repo,
      state: "all",
      since: syncState?.lastPrUpdatedAt ?? undefined,
    });
    prs = prResult.prs;
    if (prResult.rateLimited) {
      wasRateLimited = true;
      progress("⚠ Rate limited", prResult.rateLimitMessage);
    }
    progress("Pull requests fetched", `${prs.length} PRs${prResult.rateLimited ? " (partial)" : ""}`);

    // 4. Persist commits + file stats
    progress("Storing commits & file stats…");

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
    let reviewErrors = 0;
    for (let i = 0; i < prs.length; i++) {
      const pr = prs[i];
      progress("Fetching reviews…", `PR #${pr.number} (${i + 1}/${prs.length})`);
      let reviews;
      try {
        reviews = await fetchPRReviews(owner, repo, pr.number);
      } catch (err) {
        const rateErr = asRateLimitError(err);
        if (rateErr) {
          wasRateLimited = true;
          progress("⚠ Rate limited", `Reviews rate limited at PR #${pr.number}. Retry in ${Math.ceil(rateErr.retryAfterSeconds / 60)} min.`);
          break;
        }
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
      const rateErr = asRateLimitError(err);
      if (rateErr) {
        wasRateLimited = true;
        progress("⚠ Rate limited", `Star history rate limited. Retry in ${Math.ceil(rateErr.retryAfterSeconds / 60)} min.`);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        progress("⚠ Star history failed", msg);
      }
    }
  } finally {
    // Always save sync state — even on error/rate-limit, preserve partial progress
    try {
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
    } catch {
      // Best-effort sync state save
    }

    // Detach rate-limit callback
    setRateLimitNotify(null);
  }

  // If rate limited, throw a specific error so the caller can provide retry guidance
  if (wasRateLimited) {
    throw new GitHubRateLimitError(
      `Sync completed partially due to GitHub API rate limiting. ${commitsCollected} commits, ${prsCollected} PRs collected. Data saved — retry to continue.`,
      60
    );
  }

  return {
    projectId,
    commitsCollected,
    prsCollected,
    reviewsCollected,
    fileStatsCollected,
    rateLimited: false,
  };
}
