import { getOctokit } from "./client";

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

/**
 * Fetch commits from the GitHub API.
 * Used to get commit metadata (author mapping).
 * File-level stats come from git clone + git log --numstat.
 */
export async function fetchCommits(
  opts: FetchCommitsOptions
): Promise<CommitData[]> {
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

  return commits;
}
