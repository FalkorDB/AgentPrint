import { getOctokit } from "./client";

export interface StarPoint {
  month: string; // YYYY-MM
  cumulativeStars: number;
}

/**
 * Fetch monthly cumulative star history by sampling the stargazers API.
 */
export async function fetchStarHistory(
  owner: string,
  repo: string,
  onProgress?: (detail: string) => void
): Promise<{ history: StarPoint[]; totalStars: number }> {
  const octokit = getOctokit();
  const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
  const totalStars = repoData.stargazers_count;

  if (totalStars === 0) {
    return { history: [], totalStars: 0 };
  }

  const perPage = 100;
  const totalPages = Math.ceil(totalStars / perPage);

  // Pick up to 30 evenly-spaced pages to sample the curve
  const MAX_SAMPLES = 30;
  const pagesToFetch: number[] = [];
  if (totalPages <= MAX_SAMPLES) {
    for (let p = 1; p <= totalPages; p++) pagesToFetch.push(p);
  } else {
    for (let i = 0; i < MAX_SAMPLES; i++) {
      pagesToFetch.push(
        Math.max(1, Math.round((i / (MAX_SAMPLES - 1)) * (totalPages - 1)) + 1)
      );
    }
    const unique = [...new Set(pagesToFetch)];
    pagesToFetch.length = 0;
    pagesToFetch.push(...unique);
  }

  const rawPoints: Array<{ month: string; cumIdx: number }> = [];

  for (let i = 0; i < pagesToFetch.length; i += 5) {
    const batch = pagesToFetch.slice(i, i + 5);
    onProgress?.(`${Math.min(i + 5, pagesToFetch.length)}/${pagesToFetch.length} pages`);

    const results = await Promise.all(
      batch.map(async (page) => {
        try {
          const { data } = await octokit.request(
            "GET /repos/{owner}/{repo}/stargazers",
            {
              owner,
              repo,
              per_page: perPage,
              page,
              headers: { accept: "application/vnd.github.star+json" },
            }
          );
          return { page, data: data as Array<{ starred_at: string }> };
        } catch {
          return { page, data: [] };
        }
      })
    );

    for (const { page, data } of results) {
      for (let j = 0; j < data.length; j++) {
        const starred = data[j];
        if (starred.starred_at) {
          const d = new Date(starred.starred_at);
          const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
          const cumIdx = (page - 1) * perPage + j + 1;
          rawPoints.push({ month, cumIdx });
        }
      }
    }
  }

  rawPoints.sort((a, b) => a.cumIdx - b.cumIdx);

  // For each month, take the max cumulative index
  const monthMap = new Map<string, number>();
  for (const pt of rawPoints) {
    const existing = monthMap.get(pt.month);
    if (!existing || pt.cumIdx > existing) {
      monthMap.set(pt.month, pt.cumIdx);
    }
  }

  const history: StarPoint[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, cumulativeStars]) => ({ month, cumulativeStars }));

  return { history, totalStars };
}
