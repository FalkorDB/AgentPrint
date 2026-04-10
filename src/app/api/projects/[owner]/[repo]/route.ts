import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getOctokit } from "@/lib/github/client";
import { auth } from "@/auth";

/**
 * @swagger
 * /api/projects/{owner}/{repo}:
 *   put:
 *     summary: Add or update a project
 *     description: Creates or updates a project by owner/repo. Fetches GitHub metadata (stars, default branch, commit/PR counts) with a 15s timeout.
 *     tags: [Projects]
 *     security:
 *       - session: []
 *     parameters:
 *       - name: owner
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: GitHub repository owner
 *       - name: repo
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: GitHub repository name
 *     responses:
 *       201:
 *         description: Project created or updated
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 *   delete:
 *     summary: Remove a project
 *     description: Deletes a project and all its associated data.
 *     tags: [Projects]
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
 *         description: Project deleted
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Project not found
 */
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
  let githubError: string | undefined;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const octokit = getOctokit();
    const { data: repoData } = await octokit.rest.repos.get({
      owner, repo,
      request: { signal: controller.signal },
    });
    branch = repoData.default_branch;
    githubStars = repoData.stargazers_count;

    // Run enrichment in parallel — these are optional, failures are non-fatal
    await Promise.allSettled([
      (async () => {
        const firstPage = await octokit.rest.repos.listCommits({
          owner, repo, sha: branch!, per_page: 1,
          request: { signal: controller.signal },
        });
        const linkHeader = firstPage.headers.link || "";
        const lastPageMatch = linkHeader.match(/[&?]page=(\d+)>;\s*rel="last"/);
        if (lastPageMatch) {
          const lastPage = parseInt(lastPageMatch[1], 10);
          const { data: oldest } = await octokit.rest.repos.listCommits({
            owner, repo, sha: branch!, per_page: 1, page: lastPage,
            request: { signal: controller.signal },
          });
          if (oldest.length > 0) {
            const date = oldest[0].commit.author?.date || oldest[0].commit.committer?.date;
            if (date) githubCreatedAt = new Date(date);
          }
        } else if (firstPage.data.length > 0) {
          const date = firstPage.data[0].commit.author?.date || firstPage.data[0].commit.committer?.date;
          if (date) githubCreatedAt = new Date(date);
        }
        if (!githubCreatedAt && repoData.created_at) {
          githubCreatedAt = new Date(repoData.created_at);
        }
      })(),
      (async () => {
        const [commitSearch, prSearch] = await Promise.all([
          octokit.rest.search.commits({
            q: `repo:${owner}/${repo} merge:false`, per_page: 1,
            request: { signal: controller.signal },
          }),
          octokit.rest.search.issuesAndPullRequests({
            q: `repo:${owner}/${repo} is:pr`, per_page: 1,
            request: { signal: controller.signal },
          }),
        ]);
        githubCommitCount = commitSearch.data.total_count;
        githubPrCount = prSearch.data.total_count;
      })(),
    ]);
  } catch (err) {
    if (controller.signal.aborted) {
      githubError = "GitHub API timed out";
    } else if (err instanceof Error && err.message.includes("rate limit")) {
      githubError = "GitHub API rate limited";
    } else {
      githubError = "GitHub API error";
    }
    console.error(`PUT /api/projects/${owner}/${repo}:`, err);
    if (!branch) branch = "main";
  } finally {
    clearTimeout(timeout);
  }

  try {
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

    return NextResponse.json(
      { ...project, ...(githubError && { warning: githubError }) },
      { status: 201 },
    );
  } catch (err) {
    console.error(`PUT /api/projects/${owner}/${repo} DB error:`, err);
    return NextResponse.json({ error: "Failed to save project" }, { status: 500 });
  }
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
