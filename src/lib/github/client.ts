import { Octokit } from "octokit";

let octokitInstance: Octokit | null = null;

export function getOctokit(): Octokit {
  if (octokitInstance) return octokitInstance;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  octokitInstance = new Octokit({ auth: token });
  return octokitInstance;
}

/** Known bot accounts to exclude from contributor counts */
export const BOT_LOGINS = new Set([
  "dependabot[bot]",
  "dependabot",
  "renovate[bot]",
  "renovate",
  "github-actions[bot]",
  "github-actions",
  "codecov[bot]",
  "greenkeeper[bot]",
  "snyk-bot",
  "mergify[bot]",
  "allcontributors[bot]",
  "stale[bot]",
  "semantic-release-bot",
]);

export function isBot(login: string | null | undefined): boolean {
  if (!login) return false;
  return BOT_LOGINS.has(login) || login.endsWith("[bot]");
}
