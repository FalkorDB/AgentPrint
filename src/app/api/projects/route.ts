import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { apiAuth } from "@/lib/api-auth";

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: List all tracked projects
 *     description: Returns all projects with sync state, commit/PR/metric counts, sorted by GitHub stars. This is a public endpoint.
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           minimum: 1
 *           maximum: 100
 *         description: Maximum number of projects to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *           minimum: 0
 *         description: Number of projects to skip
 *     responses:
 *       200:
 *         description: Array of project objects
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 50), 1), 100);
  const offset = Math.max(Number(searchParams.get("offset") ?? 0), 0);

  const authResult = await apiAuth(request);
  const isAuthenticated = authResult.authenticated;

  const projects = await prisma.project.findMany({
    skip: offset,
    take: limit,
    where: isAuthenticated
      ? undefined
      : { syncState: { lastSyncAt: { not: null } } },
    include: {
      syncState: { select: { lastSyncAt: true } },
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
