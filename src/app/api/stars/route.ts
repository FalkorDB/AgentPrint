import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchStarHistory } from "@/lib/github/stars";

/**
 * GET /api/stars?owner=X&repo=Y
 * Returns monthly cumulative star counts.
 * Reads from DB if available, otherwise fetches live from GitHub API
 * and persists the results for next time.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  if (!owner || !repo) {
    return NextResponse.json({ error: "owner and repo required" }, { status: 400 });
  }

  try {
    const project = await prisma.project.findUnique({
      where: { owner_repo: { owner, repo } },
      select: { id: true, githubStars: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const starHistory = await prisma.starHistory.findMany({
      where: { projectId: project.id },
      orderBy: { month: "asc" },
    });

    // If DB has data, return it
    if (starHistory.length > 0) {
      const history = starHistory.map((s) => ({
        date: s.month,
        stars: s.cumulativeStars,
      }));
      return NextResponse.json({ history, totalStars: project.githubStars ?? 0 });
    }

    // Fall back to live GitHub API and persist results
    const { history: liveHistory, totalStars } = await fetchStarHistory(owner, repo);

    for (const point of liveHistory) {
      await prisma.starHistory.upsert({
        where: { projectId_month: { projectId: project.id, month: point.month } },
        update: { cumulativeStars: point.cumulativeStars },
        create: { projectId: project.id, month: point.month, cumulativeStars: point.cumulativeStars },
      });
    }
    await prisma.project.update({
      where: { id: project.id },
      data: { githubStars: totalStars },
    });

    const history = liveHistory.map((p) => ({ date: p.month, stars: p.cumulativeStars }));
    return NextResponse.json({ history, totalStars });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
