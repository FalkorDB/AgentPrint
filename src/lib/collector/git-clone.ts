import { getOctokit, asRateLimitError } from "../github/client";

/** File patterns to exclude from line-count metrics */
const EXCLUDED_PATTERNS = [
  /package-lock\.json$/,
  /yarn\.lock$/,
  /pnpm-lock\.yaml$/,
  /Gemfile\.lock$/,
  /Cargo\.lock$/,
  /poetry\.lock$/,
  /composer\.lock$/,
  /\.lock$/,
  /\.generated\./,
  /^dist\//,
  /^build\//,
  /\/dist\//,
  /\/build\//,
];

export function isExcludedFile(filePath: string): boolean {
  return EXCLUDED_PATTERNS.some((pattern) => pattern.test(filePath));
}

export interface GitFileChange {
  sha: string;
  authorEmail: string;
  authorName: string;
  date: Date;
  path: string;
  additions: number;
  deletions: number;
}

export type FileChangeProgress = (done: number, total: number) => void;

export interface FileChangeFetchResult {
  changes: GitFileChange[];
  rateLimited: boolean;
  rateLimitMessage?: string;
  rateLimitedCommits: number;
}

/**
 * Fetch per-file changes from the GitHub API for each commit.
 * Reports rate limit errors instead of silently swallowing them.
 */
export async function getFileChanges(
  owner: string,
  repo: string,
  _branch: string,
  since?: Date,
  lastSha?: string,
  onProgress?: FileChangeProgress
): Promise<FileChangeFetchResult> {
  const octokit = getOctokit();
  const changes: GitFileChange[] = [];

  // List commits in the window
  const commits: Array<{ sha: string; authorEmail: string; authorName: string; date: Date }> = [];
  const iterator = octokit.paginate.iterator(octokit.rest.repos.listCommits, {
    owner,
    repo,
    since: since?.toISOString(),
    per_page: 100,
  });

  try {
    for await (const { data } of iterator) {
      for (const c of data) {
        if (lastSha && c.sha === lastSha) break;
        commits.push({
          sha: c.sha,
          authorEmail: c.commit.author?.email ?? "",
          authorName: c.commit.author?.name ?? "",
          date: new Date(c.commit.committer?.date ?? c.commit.author?.date ?? ""),
        });
      }
    }
  } catch (err) {
    const rateErr = asRateLimitError(err);
    if (rateErr) {
      return {
        changes: [],
        rateLimited: true,
        rateLimitMessage: `Rate limited while listing commits. Retry in ${Math.ceil(rateErr.retryAfterSeconds / 60)} min.`,
        rateLimitedCommits: 0,
      };
    }
    throw err;
  }

  const total = commits.length;
  let rateLimitedCommits = 0;
  let hitRateLimit = false;
  let rateLimitMessage: string | undefined;

  // Fetch file stats per commit (batched with concurrency limit)
  const BATCH_SIZE = 10;
  for (let i = 0; i < commits.length; i += BATCH_SIZE) {
    if (hitRateLimit) break;

    const batch = commits.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(async (commit) => {
        try {
          const { data } = await octokit.rest.repos.getCommit({
            owner,
            repo,
            ref: commit.sha,
          });
          return { commit, files: data.files ?? [], rateLimited: false };
        } catch (err) {
          const rateErr = asRateLimitError(err);
          if (rateErr) {
            rateLimitedCommits++;
            hitRateLimit = true;
            rateLimitMessage = `Rate limited after ${i + rateLimitedCommits} of ${total} commits. Retry in ${Math.ceil(rateErr.retryAfterSeconds / 60)} min.`;
            return { commit, files: [] as Array<{ filename: string; additions?: number; deletions?: number }>, rateLimited: true };
          }
          return { commit, files: [] as Array<{ filename: string; additions?: number; deletions?: number }>, rateLimited: false };
        }
      })
    );

    for (const { commit, files } of results) {
      for (const file of files) {
        if (!isExcludedFile(file.filename)) {
          changes.push({
            sha: commit.sha,
            authorEmail: commit.authorEmail,
            authorName: commit.authorName,
            date: commit.date,
            path: file.filename,
            additions: file.additions ?? 0,
            deletions: file.deletions ?? 0,
          });
        }
      }
    }

    if (onProgress) onProgress(Math.min(i + BATCH_SIZE, total), total);
  }

  return {
    changes,
    rateLimited: hitRateLimit,
    rateLimitMessage,
    rateLimitedCommits,
  };
}
