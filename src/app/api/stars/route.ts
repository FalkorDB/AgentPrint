import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/stars?owner=X&repo=Y
 * Returns monthly cumulative star counts from the database.
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

    const history = starHistory.map((s) => ({
      date: s.month,
      stars: s.cumulativeStars,
    }));

    return NextResponse.json({ history, totalStars: project.githubStars ?? 0 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
