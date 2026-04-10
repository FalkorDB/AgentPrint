import { NextRequest, NextResponse } from "next/server";
import { collectProjectData } from "@/lib/collector";
import { computeAndStoreMetrics } from "@/lib/metrics/compute";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { projectId } = body;

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 }
    );
  }

  try {
    // Step 1: Collect raw data from GitHub
    const collectionResult = await collectProjectData(projectId);

    // Step 2: Compute metrics from collected data
    const metrics = await computeAndStoreMetrics(projectId);

    return NextResponse.json({
      collection: collectionResult,
      metrics,
    });
  } catch (error) {
    console.error("Collection failed:", error);
    return NextResponse.json(
      {
        error: "Collection failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
