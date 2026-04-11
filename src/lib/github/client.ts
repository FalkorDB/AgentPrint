import { Octokit } from "octokit";
import { throttling } from "@octokit/plugin-throttling";

const ThrottledOctokit = Octokit.plugin(throttling);

/** Typed error for GitHub API rate limit exhaustion */
export class GitHubRateLimitError extends Error {
  readonly retryAfterSeconds: number;
  readonly resetAt: Date;

  constructor(message: string, retryAfterSeconds: number) {
    super(message);
    this.name = "GitHubRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
    this.resetAt = new Date(Date.now() + retryAfterSeconds * 1000);
  }
}

/** Detect whether an error is a GitHub rate limit error and wrap it */
export function asRateLimitError(err: unknown): GitHubRateLimitError | null {
  if (err instanceof GitHubRateLimitError) return err;
  if (!(err instanceof Error)) return null;

  const msg = err.message.toLowerCase();
  const isRateLimit =
    msg.includes("rate limit") ||
    msg.includes("api rate limit") ||
    msg.includes("secondary rate limit") ||
    msg.includes("abuse detection");

  // Octokit RequestError has status field
  const status = (err as { status?: number }).status;
  if (isRateLimit || status === 429 || (status === 403 && msg.includes("rate"))) {
    // Try to extract retry-after from the error response headers
    const headers = (err as { response?: { headers?: Record<string, string> } }).response?.headers;
    const retryAfter = parseInt(headers?.["retry-after"] ?? "60", 10);
    return new GitHubRateLimitError(err.message, retryAfter);
  }

  return null;
}

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
