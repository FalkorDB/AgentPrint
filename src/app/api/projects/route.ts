import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

const SORT_FIELDS: Record<string, Prisma.ProjectOrderByWithRelationInput> = {
  name: { owner: "asc" },
  score: { impactScore: { sort: "desc", nulls: "last" } },
  stars: { githubStars: { sort: "desc", nulls: "last" } },
  lastSync: { syncState: { lastSyncAt: { sort: "desc", nulls: "last" } } },
};

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: List tracked projects
 *     description: Returns paginated projects with sync state, commit/PR/metric counts. Supports search, sorting, and pagination. This is a public endpoint.
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: q
 *         schema:
 *           type: string
 *         description: "Search filter — matches against owner and repo (case-insensitive)"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           minimum: 1
 *           maximum: 100
 *         description: Results per page
 *       - in: query
 *         name: sort
 *         schema:
 *           type: string
 *           enum: [name, score, stars, lastSync]
 *           default: name
 *         description: Sort field
 *       - in: query
 *         name: order
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: asc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Paginated project list
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 projects:
 *                   type: array
 *                   items:
 *                     type: object
 *                 total:
 *                   type: integer
 *                 page:
 *                   type: integer
 *                 limit:
 *                   type: integer
 *                 hasMore:
 *                   type: boolean
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const page = Math.max(Number(searchParams.get("page") ?? 1), 1);
  const limit = Math.min(Math.max(Number(searchParams.get("limit") ?? 20), 1), 100);
  const sortKey = searchParams.get("sort") ?? "name";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";

  // Build where clause for search
  const where: Prisma.ProjectWhereInput = q
    ? {
        OR: [
          { owner: { contains: q, mode: "insensitive" } },
          { repo: { contains: q, mode: "insensitive" } },
        ],
      }
    : {};

  // Build orderBy — flip direction if user requested opposite of default
  let orderBy: Prisma.ProjectOrderByWithRelationInput =
    SORT_FIELDS[sortKey] ?? SORT_FIELDS.name;

  // For "name" sort, apply the user-requested order directly
  if (sortKey === "name") {
    orderBy = { owner: order };
  }
  // For numeric/date sorts whose defaults are desc, flip if user wants asc
  else if (sortKey === "stars") {
    orderBy = { githubStars: { sort: order, nulls: "last" } };
  } else if (sortKey === "score") {
    orderBy = { impactScore: { sort: order, nulls: "last" } };
  } else if (sortKey === "lastSync") {
    orderBy = { syncState: { lastSyncAt: { sort: order, nulls: "last" } } };
  }

  const skip = (page - 1) * limit;

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      skip,
      take: limit,
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
      orderBy,
    }),
    prisma.project.count({ where }),
  ]);

  return NextResponse.json({
    projects,
    total,
    page,
    limit,
    hasMore: skip + projects.length < total,
  });
}
