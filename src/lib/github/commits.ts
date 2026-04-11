import { getOctokit, asRateLimitError } from "./client";

interface FetchCommitsOptions {
  owner: string;
  repo: string;
  sha?: string;
  since?: Date;
}

export interface CommitData {
  sha: string;
  authorLogin: string | null;
  authorEmail: string | null;
  authorName: string | null;
  message: string;
  committedAt: Date;
}

export interface CommitFetchResult {
  commits: CommitData[];
  rateLimited: boolean;
  rateLimitMessage?: string;
}

/**
 * Fetch commits from the GitHub API.
 * Returns partial results if rate limited instead of crashing.
 */
export async function fetchCommits(
  opts: FetchCommitsOptions
): Promise<CommitFetchResult> {
  const octokit = getOctokit();
  const commits: CommitData[] = [];

  const iterator = octokit.paginate.iterator(
    octokit.rest.repos.listCommits,
    {
      owner: opts.owner,
      repo: opts.repo,
      sha: opts.sha,
      since: opts.since?.toISOString(),
      per_page: 100,
    }
  );

  try {
    for await (const { data } of iterator) {
      for (const commit of data) {
        commits.push({
          sha: commit.sha,
          authorLogin: commit.author?.login ?? null,
          authorEmail: commit.commit.author?.email ?? null,
          authorName: commit.commit.author?.name ?? null,
          message: commit.commit.message ?? "",
          committedAt: new Date(
            commit.commit.committer?.date ?? commit.commit.author?.date ?? ""
          ),
        });
      }
    }
  } catch (err) {
    const rateErr = asRateLimitError(err);
    if (rateErr) {
      return {
        commits,
        rateLimited: true,
        rateLimitMessage: `Rate limited after ${commits.length} commits. Retry in ${Math.ceil(rateErr.retryAfterSeconds / 60)} min.`,
      };
    }
    throw err;
  }

  return { commits, rateLimited: false };
}
