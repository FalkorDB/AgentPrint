import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { collectProjectData } from "@/lib/collector";
import { computeAndStoreMetrics } from "@/lib/metrics/compute";
import { computeAndStoreScore } from "@/lib/metrics/score";
import { apiAuth } from "@/lib/api-auth";

/** In-flight sync jobs keyed by projectId so clients can reconnect */
const activeJobs = new Map<
  string,
  { logs: { step: string; detail?: string }[]; done: boolean; error?: string }
>();

async function resolveProjectId(owner: string, repo: string): Promise<string | null> {
  const project = await prisma.project.findFirst({
    where: {
      owner: { equals: owner, mode: "insensitive" },
      repo: { equals: repo, mode: "insensitive" },
    },
    select: { id: true },
  });
  return project?.id ?? null;
}

/**
 * @swagger
 * /api/projects/{owner}/{repo}/collect:
 *   post:
 *     summary: Start data collection
 *     description: Triggers GitHub data sync for a project. Returns an SSE stream with progress updates. Computes metrics and agent impact score on completion.
 *     tags: [Collection]
 *     security:
 *       - session: []
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
 *         description: SSE event stream with sync progress
 *         content:
 *           text/event-stream: {}
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 *   get:
 *     summary: Reconnect to active sync job
 *     description: Returns an SSE stream for an in-flight sync job, or idle status JSON if no job is running.
 *     tags: [Collection]
 *     security:
 *       - session: []
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
 *         description: SSE stream or idle status
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const authResult = await apiAuth(request);
  if (!authResult.authenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { owner, repo } = await params;
  const projectId = await resolveProjectId(owner, repo);

  if (!projectId) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // If a job is already running for this project, stream its logs
  let job = activeJobs.get(projectId);
  if (job && !job.done) {
    return streamJob(projectId);
  }

  // Start a new job
  job = { logs: [], done: false };
  activeJobs.set(projectId, job);

  function log(step: string, detail?: string) {
    job!.logs.push({ step, detail });
  }

  // Fire-and-forget: collection runs independently of the stream
  (async () => {
    try {
      const result = await collectProjectData(projectId, log);
      log("Computing metrics…");
      const metrics = await computeAndStoreMetrics(projectId);
      log("Computing agent impact score…");
      const scoreResult = await computeAndStoreScore(projectId);
      const scoreMsg = scoreResult
        ? `Agent Impact: ${scoreResult.score}/100 (${scoreResult.confidence} confidence)`
        : "Agent Impact: insufficient data";
      log(
        "Done",
        `${result.commitsCollected} commits, ${result.prsCollected} PRs, ${metrics.length} months · ${scoreMsg}`
      );
    } catch (error) {
      job!.error =
        error instanceof Error ? error.message : String(error);
      log("❌ Error", job!.error);
    } finally {
      job!.done = true;
      setTimeout(() => activeJobs.delete(projectId), 60_000);
    }
  })();

  return streamJob(projectId);
}

/** GET to reconnect to an in-flight job's progress */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const authResult = await apiAuth(request);
  if (!authResult.authenticated) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { owner, repo } = await params;
  const projectId = await resolveProjectId(owner, repo);

  if (!projectId) {
    return new Response(JSON.stringify({ error: "Project not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const job = activeJobs.get(projectId);
  if (!job) {
    return new Response(JSON.stringify({ status: "idle" }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return streamJob(projectId);
}

function streamJob(projectId: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let cursor = 0;

      function flush() {
        const job = activeJobs.get(projectId);
        if (!job) return true;

        while (cursor < job.logs.length) {
          const entry = job.logs[cursor++];
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ step: entry.step, detail: entry.detail })}\n\n`)
            );
          } catch {
            return true;
          }
        }

        if (job.done) {
          try {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ done: true, error: job.error })}\n\n`
              )
            );
          } catch {
            // ignore
          }
          return true;
        }
        return false;
      }

      while (true) {
        const finished = flush();
        if (finished) break;
        await new Promise((r) => setTimeout(r, 300));
      }

      try {
        controller.close();
      } catch {
        // already closed
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
