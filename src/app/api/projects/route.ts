import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

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
