import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOctokit } from "@/lib/github/client";
import { auth } from "@/auth";

export async function GET() {
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
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { owner, repo, defaultBranch } = body;

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "owner and repo are required" },
      { status: 400 }
    );
  }

  // Auto-detect default branch from GitHub if not explicitly provided
  let branch = defaultBranch;
  if (!branch) {
    try {
      const octokit = getOctokit();
      const { data } = await octokit.rest.repos.get({ owner, repo });
      branch = data.default_branch;
    } catch {
      branch = "main";
    }
  }

  const project = await prisma.project.upsert({
    where: { owner_repo: { owner, repo } },
    update: { defaultBranch: branch },
    create: {
      owner,
      repo,
      defaultBranch: branch,
    },
  });

  return NextResponse.json(project, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  await prisma.project.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
