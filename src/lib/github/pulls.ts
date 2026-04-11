import { getOctokit, isBot, asRateLimitError } from "./client";

interface FetchPRsOptions {
  owner: string;
  repo: string;
  since?: Date;
  state?: "open" | "closed" | "all";
}

export interface PRData {
  number: number;
  authorLogin: string | null;
  title: string;
  state: string;
  merged: boolean;
  createdAt: Date;
  mergedAt: Date | null;
  closedAt: Date | null;
}

export interface PRReviewData {
  prNumber: number;
  reviewerLogin: string;
  state: string;
  submittedAt: Date;
}

export interface PRFetchResult {
  prs: PRData[];
  rateLimited: boolean;
  rateLimitMessage?: string;
}

export async function fetchPullRequests(
  opts: FetchPRsOptions
): Promise<PRFetchResult> {
  const octokit = getOctokit();
  const prs: PRData[] = [];

  const iterator = octokit.paginate.iterator(
    octokit.rest.pulls.list,
    {
      owner: opts.owner,
      repo: opts.repo,
      state: opts.state ?? "all",
      sort: "updated",
      direction: "desc",
      per_page: 100,
    }
  );

  try {
    for await (const { data } of iterator) {
      for (const pr of data) {
        const createdAt = new Date(pr.created_at);

        if (opts.since && new Date(pr.updated_at) < opts.since) {
          return { prs, rateLimited: false };
        }

        if (isBot(pr.user?.login)) continue;

        prs.push({
          number: pr.number,
          authorLogin: pr.user?.login ?? null,
          title: pr.title,
          state: pr.merged_at ? "merged" : pr.state,
          merged: !!pr.merged_at,
          createdAt,
          mergedAt: pr.merged_at ? new Date(pr.merged_at) : null,
          closedAt: pr.closed_at ? new Date(pr.closed_at) : null,
        });
      }
    }
  } catch (err) {
    const rateErr = asRateLimitError(err);
    if (rateErr) {
      return {
        prs,
        rateLimited: true,
        rateLimitMessage: `Rate limited after ${prs.length} PRs. Retry in ${Math.ceil(rateErr.retryAfterSeconds / 60)} min.`,
      };
    }
    throw err;
  }

  return { prs, rateLimited: false };
}

export async function fetchPRReviews(
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRReviewData[]> {
  const octokit = getOctokit();
  const reviews: PRReviewData[] = [];

  const iterator = octokit.paginate.iterator(
    octokit.rest.pulls.listReviews,
    {
      owner,
      repo,
      pull_number: prNumber,
      per_page: 100,
    }
  );

  for await (const { data } of iterator) {
    for (const review of data) {
      if (!review.user?.login || isBot(review.user.login)) continue;
      if (!review.submitted_at) continue;

      reviews.push({
        prNumber,
        reviewerLogin: review.user.login,
        state: review.state,
        submittedAt: new Date(review.submitted_at),
      });
    }
  }

  return reviews;
}
