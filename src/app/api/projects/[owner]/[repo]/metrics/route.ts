import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;

  const project = await prisma.project.findFirst({
    where: {
      owner: { equals: owner, mode: "insensitive" },
      repo: { equals: repo, mode: "insensitive" },
    },
    select: { id: true, owner: true, repo: true, impactScore: true, impactConfidence: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const metrics = await prisma.monthlyMetric.findMany({
    where: { projectId: project.id },
    orderBy: { month: "asc" },
  });

  return NextResponse.json({ project, metrics });
}
