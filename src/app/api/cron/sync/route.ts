import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { collectProjectData } from "@/lib/collector";
import { computeAndStoreMetrics } from "@/lib/metrics/compute";
import { computeAndStoreScore } from "@/lib/metrics/score";

const SYNC_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * @swagger
 * /api/cron/sync:
 *   post:
 *     summary: Sync all stale projects
 *     description: Triggers background data collection for every tracked project whose last sync was more than 24 hours ago (or has never been synced). Protected by the CRON_SECRET environment variable when set.
 *     tags: [Cron]
 *     security:
 *       - bearer: []
 *     responses:
 *       200:
 *         description: List of project slugs whose sync was triggered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 triggered:
 *                   type: array
 *                   items:
 *                     type: string
 *                   description: "owner/repo slugs queued for sync"
 *       401:
 *         description: Unauthorized (CRON_SECRET mismatch)
 */
export async function POST(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.match(/^bearer\s+(.+)$/i)?.[1]?.trim();
    if (token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const cutoff = new Date(Date.now() - SYNC_INTERVAL_MS);

  // Find all projects that have never been synced or were last synced > 24h ago
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { syncState: { is: null } },
        { syncState: { lastSyncAt: null } },
        { syncState: { lastSyncAt: { lt: cutoff } } },
      ],
    },
    select: { id: true, owner: true, repo: true },
  });

  // Fire-and-forget: run syncs sequentially in the background to avoid
  // overwhelming the GitHub API with concurrent requests.
  (async () => {
    for (const project of projects) {
      try {
        await collectProjectData(project.id);
        await computeAndStoreMetrics(project.id);
        await computeAndStoreScore(project.id);
      } catch (err) {
        console.error(
          `[cron/sync] Failed to sync ${project.owner}/${project.repo}:`,
          err instanceof Error ? err.message : String(err)
        );
      }
    }
  })();

  return Response.json({
    triggered: projects.map((p) => `${p.owner}/${p.repo}`),
  });
}
