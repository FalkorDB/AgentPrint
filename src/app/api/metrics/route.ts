import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");

  if (!projectId) {
    return NextResponse.json(
      { error: "project_id is required" },
      { status: 400 }
    );
  }

  const metrics = await prisma.monthlyMetric.findMany({
    where: { projectId },
    orderBy: { month: "asc" },
  });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { owner: true, repo: true },
  });

  return NextResponse.json({
    project,
    metrics,
  });
}
