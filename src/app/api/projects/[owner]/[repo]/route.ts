import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOctokit } from "@/lib/github/client";
import { auth } from "@/auth";

export async function PUT(
  _request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, repo } = await params;

  let branch: string | undefined;
  let githubCommitCount: number | undefined;
  let githubPrCount: number | undefined;
  let githubStars: number | undefined;
  let githubCreatedAt: Date | undefined;

  // Wrap all GitHub API calls in a timeout so the endpoint always returns
  try {
    await Promise.race([
      (async () => {
        const octokit = getOctokit();
        const { data: repoData } = await octokit.rest.repos.get({ owner, repo });
        branch = repoData.default_branch;
        githubStars = repoData.stargazers_count;

        // Run oldest-commit lookup and search API calls in parallel
        await Promise.allSettled([
          // Oldest commit date
          (async () => {
            try {
              const firstPage = await octokit.rest.repos.listCommits({
                owner, repo, sha: branch!, per_page: 1,
              });
              const linkHeader = firstPage.headers.link || "";
              const lastPageMatch = linkHeader.match(/[&?]page=(\d+)>;\s*rel="last"/);
              if (lastPageMatch) {
                const lastPage = parseInt(lastPageMatch[1], 10);
                const { data: oldest } = await octokit.rest.repos.listCommits({
                  owner, repo, sha: branch!, per_page: 1, page: lastPage,
                });
                if (oldest.length > 0) {
                  const date = oldest[0].commit.author?.date || oldest[0].commit.committer?.date;
                  if (date) githubCreatedAt = new Date(date);
                }
              } else if (firstPage.data.length > 0) {
                const date = firstPage.data[0].commit.author?.date || firstPage.data[0].commit.committer?.date;
                if (date) githubCreatedAt = new Date(date);
              }
            } catch {
              if (repoData.created_at) githubCreatedAt = new Date(repoData.created_at);
            }
          })(),
          // Commit & PR counts via search API
          (async () => {
            try {
              const [commitSearch, prSearch] = await Promise.all([
                octokit.rest.search.commits({ q: `repo:${owner}/${repo} merge:false`, per_page: 1 }),
                octokit.rest.search.issuesAndPullRequests({ q: `repo:${owner}/${repo} is:pr`, per_page: 1 }),
              ]);
              githubCommitCount = commitSearch.data.total_count;
              githubPrCount = prSearch.data.total_count;
            } catch {
              // Search API may be rate-limited
            }
          })(),
        ]);
      })(),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 15_000)),
    ]);
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
      defaultBranch: branch ?? "main",
      githubCommitCount: githubCommitCount ?? null,
      githubPrCount: githubPrCount ?? null,
      githubStars: githubStars ?? null,
      githubCreatedAt: githubCreatedAt ?? null,
    },
  });

  return NextResponse.json(project, { status: 201 });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { owner, repo } = await params;

  const project = await prisma.project.findFirst({
    where: {
      owner: { equals: owner, mode: "insensitive" },
      repo: { equals: repo, mode: "insensitive" },
    },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  await prisma.project.delete({ where: { id: project.id } });
  return NextResponse.json({ success: true });
}
