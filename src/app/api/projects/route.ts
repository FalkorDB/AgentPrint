import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: List all tracked projects
 *     description: Returns all projects with sync state, commit/PR/metric counts, sorted by GitHub stars.
 *     tags: [Projects]
 *     security:
 *       - session: []
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of project objects
 *       401:
 *         description: Unauthorized
 */
export async function GET(_request: NextRequest) {
  const projects = await prisma.project.findMany({
    include: {
      syncState: true,
      _count: {
        select: {
          commits: true,
          pullRequests: true,
          monthlyMetrics: true,
        },
      },
    },
    orderBy: { githubStars: { sort: "desc", nulls: "last" } },
  });

  return NextResponse.json(projects);
}
