import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");

  let resolvedId = projectId;
  if (!resolvedId && owner && repo) {
    const project = await prisma.project.findFirst({
      where: { owner: { equals: owner, mode: "insensitive" }, repo: { equals: repo, mode: "insensitive" } },
      select: { id: true },
    });
    resolvedId = project?.id ?? null;
  }

  if (!resolvedId) {
    return NextResponse.json(
      { error: "project_id or owner+repo is required" },
      { status: 400 }
    );
  }

  const metrics = await prisma.monthlyMetric.findMany({
    where: { projectId: resolvedId },
    orderBy: { month: "asc" },
  });

  const project = await prisma.project.findUnique({
    where: { id: resolvedId },
    select: { owner: true, repo: true },
  });

  return NextResponse.json({
    project,
    metrics,
  });
}
