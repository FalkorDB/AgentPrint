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
    orderBy: { githubStars: { sort: "desc", nulls: "last" } },
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
  let githubCommitCount: number | undefined;
  let githubPrCount: number | undefined;
  let githubStars: number | undefined;
  let githubCreatedAt: Date | undefined;

  try {
    const octokit = getOctokit();
    const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
    if (!branch) branch = repoData.default_branch;
    githubStars = repoData.stargazers_count;

    // Get the actual first commit date (more accurate than repo created_at for forks/transfers)
    try {
      // Fetch page 1 to get total pages from Link header, then fetch last page
      const firstPage = await octokit.rest.repos.listCommits({
        owner, repo, sha: branch || repoData.default_branch, per_page: 1,
      });
      const linkHeader = firstPage.headers.link || "";
      const lastPageMatch = linkHeader.match(/[&?]page=(\d+)>;\s*rel="last"/);
      if (lastPageMatch) {
        const lastPage = parseInt(lastPageMatch[1], 10);
        const { data: oldest } = await octokit.rest.repos.listCommits({
          owner, repo, sha: branch || repoData.default_branch, per_page: 1, page: lastPage,
        });
        if (oldest.length > 0) {
          const date = oldest[0].commit.author?.date || oldest[0].commit.committer?.date;
          if (date) githubCreatedAt = new Date(date);
        }
      } else if (firstPage.data.length > 0) {
        // Only one page — single commit is both newest and oldest
        const date = firstPage.data[0].commit.author?.date || firstPage.data[0].commit.committer?.date;
        if (date) githubCreatedAt = new Date(date);
      }
    } catch {
      // Fall back to repo creation date
      if (repoData.created_at) githubCreatedAt = new Date(repoData.created_at);
    }

    // Fetch commit & PR counts in parallel via search API
    try {
      const [commitSearch, prSearch] = await Promise.all([
        octokit.rest.search.commits({ q: `repo:${owner}/${repo} merge:false`, per_page: 1 }),
        octokit.rest.search.issuesAndPullRequests({ q: `repo:${owner}/${repo} is:pr`, per_page: 1 }),
      ]);
      githubCommitCount = commitSearch.data.total_count;
      githubPrCount = prSearch.data.total_count;
    } catch {
      // Search API may be rate-limited separately; stars/branch still saved
    }
  } catch {
    if (!branch) branch = "main";
  }

  const project = await prisma.project.upsert({
    where: { owner_repo: { owner, repo } },
    update: {
      defaultBranch: branch,
      ...(githubCommitCount !== undefined && { githubCommitCount }),
      ...(githubPrCount !== undefined && { githubPrCount }),
      ...(githubStars !== undefined && { githubStars }),
      ...(githubCreatedAt !== undefined && { githubCreatedAt }),
    },
    create: {
      owner,
      repo,
      defaultBranch: branch,
      githubCommitCount: githubCommitCount ?? null,
      githubPrCount: githubPrCount ?? null,
      githubStars: githubStars ?? null,
      githubCreatedAt: githubCreatedAt ?? null,
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
