import { NextRequest } from "next/server";
import { collectProjectData } from "@/lib/collector";
import { computeAndStoreMetrics } from "@/lib/metrics/compute";
import { computeAndStoreScore } from "@/lib/metrics/score";
import { auth } from "@/auth";

/** In-flight sync jobs keyed by projectId so clients can reconnect */
const activeJobs = new Map<
  string,
  { logs: { step: string; detail?: string }[]; done: boolean; error?: string }
>();

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json();
  const { projectId } = body;

  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId is required" }), {
      status: 400,
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
      // Clean up after 60s so status is queryable briefly after completion
      setTimeout(() => activeJobs.delete(projectId), 60_000);
    }
  })();

  return streamJob(projectId);
}

/** GET to reconnect to an in-flight job's progress or list active jobs */
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");

  // List all active (non-done) job IDs
  if (!projectId) {
    const active: string[] = [];
    for (const [id, job] of activeJobs) {
      if (!job.done) active.push(id);
    }
    return new Response(JSON.stringify({ active }), {
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

        // Send any new log entries
        while (cursor < job.logs.length) {
          const entry = job.logs[cursor++];
          try {
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ step: entry.step, detail: entry.detail })}\n\n`)
            );
          } catch {
            return true; // client disconnected
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

      // Poll the job log until done or client disconnects
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
