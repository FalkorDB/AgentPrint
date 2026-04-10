import simpleGit, { SimpleGit } from "simple-git";
import * as fs from "fs";
import * as path from "path";

const CLONE_BASE = process.env.GIT_CLONE_DIR || "/tmp/agentprint-repos";

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

/**
 * Ensures a bare clone exists and is up to date.
 * Returns the path to the bare repo.
 */
export async function ensureClone(
  owner: string,
  repo: string
): Promise<{ repoPath: string; git: SimpleGit }> {
  const repoPath = path.join(CLONE_BASE, `${owner}--${repo}.git`);

  if (!fs.existsSync(CLONE_BASE)) {
    fs.mkdirSync(CLONE_BASE, { recursive: true });
  }

  if (fs.existsSync(repoPath)) {
    const git = simpleGit(repoPath);
    await git.fetch(["--all"]);
    return { repoPath, git };
  }

  const git = simpleGit();
  await git.clone(`https://github.com/${owner}/${repo}.git`, repoPath, [
    "--bare",
  ]);

  return { repoPath, git: simpleGit(repoPath) };
}

/**
 * Parse git log --numstat output for per-file additions/deletions.
 * Only includes commits on the specified branch after the given date.
 */
export async function getFileChanges(
  owner: string,
  repo: string,
  branch: string,
  since?: Date,
  lastSha?: string
): Promise<GitFileChange[]> {
  const { git } = await ensureClone(owner, repo);

  const logArgs = [
    "--numstat",
    "--format=%H|%ae|%an|%aI",
    branch,
  ];

  if (since) {
    logArgs.push(`--since=${since.toISOString()}`);
  }

  if (lastSha) {
    // Only get commits after the last known SHA
    logArgs[logArgs.indexOf(branch)] = `${lastSha}..${branch}`;
  }

  const result = await git.log(logArgs);
  const changes: GitFileChange[] = [];

  // Parse raw numstat output
  const raw = await git.raw(["log", ...logArgs]);
  const lines = raw.split("\n");

  let currentSha = "";
  let currentEmail = "";
  let currentName = "";
  let currentDate = new Date();

  for (const line of lines) {
    if (line.includes("|") && !line.startsWith("\t") && !line.match(/^\d/)) {
      const parts = line.split("|");
      if (parts.length >= 4) {
        currentSha = parts[0];
        currentEmail = parts[1];
        currentName = parts[2];
        currentDate = new Date(parts[3]);
      }
      continue;
    }

    // numstat line: additions\tdeletions\tfilepath
    const numstatMatch = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (numstatMatch && currentSha) {
      const additions =
        numstatMatch[1] === "-" ? 0 : parseInt(numstatMatch[1], 10);
      const deletions =
        numstatMatch[2] === "-" ? 0 : parseInt(numstatMatch[2], 10);
      const filePath = numstatMatch[3];

      if (!isExcludedFile(filePath)) {
        changes.push({
          sha: currentSha,
          authorEmail: currentEmail,
          authorName: currentName,
          date: currentDate,
          path: filePath,
          additions,
          deletions,
        });
      }
    }
  }

  return changes;
}
