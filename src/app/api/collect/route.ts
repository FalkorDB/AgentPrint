import { NextRequest } from "next/server";
import { collectProjectData } from "@/lib/collector";
import { computeAndStoreMetrics } from "@/lib/metrics/compute";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId } = body;

  if (!projectId) {
    return new Response(JSON.stringify({ error: "projectId is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      function send(step: string, detail?: string) {
        const data = JSON.stringify({ step, detail });
        controller.enqueue(encoder.encode(`data: ${data}\n\n`));
      }

      try {
        const result = await collectProjectData(projectId, send);

        send("Computing metrics…");
        const metrics = await computeAndStoreMetrics(projectId);

        send("Done", `${result.commitsCollected} commits, ${result.prsCollected} PRs, ${metrics.length} months`);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, collection: result, metrics })}\n\n`));
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
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
