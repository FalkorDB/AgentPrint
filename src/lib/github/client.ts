import { Octokit } from "octokit";
import { throttling } from "@octokit/plugin-throttling";

const ThrottledOctokit = Octokit.plugin(throttling);

let octokitInstance: Octokit | null = null;

/** Optional callback invoked when rate-limit backoff kicks in */
let _rateLimitNotify: ((msg: string) => void) | null = null;

export function setRateLimitNotify(cb: ((msg: string) => void) | null) {
  _rateLimitNotify = cb;
}

export function getOctokit(): Octokit {
  if (octokitInstance) return octokitInstance;

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("GITHUB_TOKEN environment variable is required");
  }

  octokitInstance = new ThrottledOctokit({
    auth: token,
    throttle: {
      onRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const route = (options as { url?: string }).url ?? "unknown";
        _rateLimitNotify?.(
          `Rate limited on ${route}, waiting ${retryAfter}s (retry ${retryCount + 1}/3)…`
        );
        return retryCount < 3;
      },
      onSecondaryRateLimit: (retryAfter, options, _octokit, retryCount) => {
        const route = (options as { url?: string }).url ?? "unknown";
        _rateLimitNotify?.(
          `Secondary rate limit on ${route}, waiting ${retryAfter}s (retry ${retryCount + 1}/3)…`
        );
        return retryCount < 3;
      },
    },
  });
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
