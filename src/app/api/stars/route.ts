import { NextRequest, NextResponse } from "next/server";
import { getOctokit } from "@/lib/github/client";

interface StarPoint {
  date: string;
  stars: number;
}

/**
 * GET /api/stars?owner=X&repo=Y
 * Returns monthly cumulative star counts by sampling the stargazers API.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
  }

  try {
    const octokit = getOctokit();

    // Get total star count
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    const totalStars = repoData.stargazers_count;

    if (totalStars === 0) {
      return NextResponse.json({ history: [] });
    }

    // Fetch stargazers with timestamps (star media type)
    // For large repos, sample pages spread across the total
    const perPage = 100;
    const totalPages = Math.ceil(totalStars / perPage);

    // Pick up to 30 evenly-spaced pages to sample the curve
    const MAX_SAMPLES = 30;
    const pagesToFetch: number[] = [];
    if (totalPages <= MAX_SAMPLES) {
      for (let p = 1; p <= totalPages; p++) pagesToFetch.push(p);
    } else {
      for (let i = 0; i < MAX_SAMPLES; i++) {
        pagesToFetch.push(Math.max(1, Math.round((i / (MAX_SAMPLES - 1)) * (totalPages - 1)) + 1));
      }
      // Dedupe
      const unique = [...new Set(pagesToFetch)];
      pagesToFetch.length = 0;
      pagesToFetch.push(...unique);
    }

    // Collect (date, cumulative_index) pairs from sampled pages
    const rawPoints: Array<{ date: string; cumIdx: number }> = [];

    // Fetch in batches of 5
    for (let i = 0; i < pagesToFetch.length; i += 5) {
      const batch = pagesToFetch.slice(i, i + 5);
      const results = await Promise.all(
        batch.map(async (page) => {
          try {
            const { data } = await octokit.request("GET /repos/{owner}/{repo}/stargazers", {
              owner,
              repo,
              per_page: perPage,
              page,
              headers: { accept: "application/vnd.github.star+json" },
            });
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
            const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const cumIdx = (page - 1) * perPage + j + 1;
            rawPoints.push({ date: month, cumIdx });
          }
        }
      }
    }

    // Sort by cumIdx
    rawPoints.sort((a, b) => a.cumIdx - b.cumIdx);

    // Aggregate: for each month, take the max cumulative index seen
    const monthMap = new Map<string, number>();
    for (const pt of rawPoints) {
      const existing = monthMap.get(pt.date);
      if (!existing || pt.cumIdx > existing) {
        monthMap.set(pt.date, pt.cumIdx);
      }
    }

    // Build sorted monthly history
    const history: StarPoint[] = Array.from(monthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stars]) => ({ date, stars }));

    return NextResponse.json({ history, totalStars });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
