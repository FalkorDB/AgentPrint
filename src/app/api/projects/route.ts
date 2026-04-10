import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: List all tracked projects
 *     description: Returns all projects with sync state, commit/PR/metric counts, sorted by GitHub stars.
 *     tags: [Projects]
 *     security:
 *       - session: []
 *     responses:
 *       200:
 *         description: Array of project objects
 *       401:
 *         description: Unauthorized
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
