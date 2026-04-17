import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";

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
  const parsedPage = parseInt(searchParams.get("page") ?? "", 10);
  const parsedLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const page = Math.max(Number.isFinite(parsedPage) ? parsedPage : 1, 1);
  const limit = Math.min(Math.max(Number.isFinite(parsedLimit) ? parsedLimit : 20, 1), 100);
  const sortKey = searchParams.get("sort") ?? "name";
  const order = searchParams.get("order") === "desc" ? "desc" : "asc";

  // Build where clause for search — support "owner/repo" slash queries
  let where: Prisma.ProjectWhereInput = {};
  if (q) {
    const slashIdx = q.indexOf("/");
    if (slashIdx !== -1) {
      const ownerPart = q.slice(0, slashIdx).trim();
      const repoPart = q.slice(slashIdx + 1).trim();
      where = {
        AND: [
          ...(ownerPart ? [{ owner: { contains: ownerPart, mode: "insensitive" as const } }] : []),
          ...(repoPart ? [{ repo: { contains: repoPart, mode: "insensitive" as const } }] : []),
        ],
      };
    } else {
      where = {
        OR: [
          { owner: { contains: q, mode: "insensitive" } },
          { repo: { contains: q, mode: "insensitive" } },
        ],
      };
    }
  }

  // Build orderBy with stable secondary keys to ensure deterministic pagination
  const tieBreaker: Prisma.ProjectOrderByWithRelationInput[] = [
    { repo: "asc" },
    { id: "asc" },
  ];

  let primaryOrder: Prisma.ProjectOrderByWithRelationInput;
  if (sortKey === "name") {
    primaryOrder = { owner: order };
  } else if (sortKey === "stars") {
    primaryOrder = { githubStars: { sort: order, nulls: "last" } };
  } else if (sortKey === "score") {
    primaryOrder = { impactScore: { sort: order, nulls: "last" } };
  } else if (sortKey === "lastSync") {
    primaryOrder = { syncState: { lastSyncAt: { sort: order, nulls: "last" } } };
  } else {
    primaryOrder = { owner: order };
  }

  const orderBy = [primaryOrder, ...tieBreaker];

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
