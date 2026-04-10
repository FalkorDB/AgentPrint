import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * @swagger
 * /api/projects/{owner}/{repo}/metrics:
 *   get:
 *     summary: Get monthly velocity metrics
 *     description: Returns all monthly metrics for a project including lines changed, PR rates, TTM/TTC, and active dev counts. Public endpoint.
 *     tags: [Metrics]
 *     parameters:
 *       - name: owner
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: repo
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Project info and metrics array
 *       404:
 *         description: Project not found
 */
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
