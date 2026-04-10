import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { hashToken } from "@/lib/api-auth";

const handler = createMcpHandler(
  (server) => {
    server.registerTool(
      "list_projects",
      {
        title: "List Projects",
        description:
          "List all tracked projects with sync state, commit/PR counts, and agent impact scores.",
        inputSchema: {},
      },
      async () => {
        const projects = await prisma.project.findMany({
          include: {
            syncState: true,
            _count: {
              select: { commits: true, pullRequests: true, monthlyMetrics: true },
            },
          },
          orderBy: { githubStars: { sort: "desc", nulls: "last" } },
        });
        return {
          content: [{ type: "text", text: JSON.stringify(projects, null, 2) }],
        };
      }
    );

    server.registerTool(
      "add_project",
      {
        title: "Add Project",
        description:
          "Add or update a GitHub project to track. Fetches metadata from GitHub automatically.",
        inputSchema: {
          owner: z.string().describe("GitHub repository owner (e.g. 'facebook')"),
          repo: z.string().describe("GitHub repository name (e.g. 'react')"),
        },
      },
      async ({ owner, repo }) => {
        const project = await prisma.project.upsert({
          where: { owner_repo: { owner, repo } },
          update: {},
          create: { owner, repo, defaultBranch: "main" },
        });
        return {
          content: [
            {
              type: "text",
              text: `Project ${owner}/${repo} added (id: ${project.id})`,
            },
          ],
        };
      }
    );

    server.registerTool(
      "delete_project",
      {
        title: "Delete Project",
        description: "Remove a tracked project and all its associated data.",
        inputSchema: {
          owner: z.string().describe("GitHub repository owner"),
          repo: z.string().describe("GitHub repository name"),
        },
      },
      async ({ owner, repo }) => {
        const project = await prisma.project.findFirst({
          where: {
            owner: { equals: owner, mode: "insensitive" },
            repo: { equals: repo, mode: "insensitive" },
          },
          select: { id: true },
        });
        if (!project) {
          return {
            content: [{ type: "text", text: `Project ${owner}/${repo} not found` }],
            isError: true,
          };
        }
        await prisma.project.delete({ where: { id: project.id } });
        return {
          content: [{ type: "text", text: `Project ${owner}/${repo} deleted` }],
        };
      }
    );

    server.registerTool(
      "get_metrics",
      {
        title: "Get Metrics",
        description:
          "Get monthly velocity metrics for a project (lines changed, PR rates, TTM, TTC, etc.).",
        inputSchema: {
          owner: z.string().describe("GitHub repository owner"),
          repo: z.string().describe("GitHub repository name"),
        },
      },
      async ({ owner, repo }) => {
        const project = await prisma.project.findFirst({
          where: {
            owner: { equals: owner, mode: "insensitive" },
            repo: { equals: repo, mode: "insensitive" },
          },
          select: { id: true, impactScore: true, impactConfidence: true },
        });
        if (!project) {
          return {
            content: [{ type: "text", text: `Project ${owner}/${repo} not found` }],
            isError: true,
          };
        }
        const metrics = await prisma.monthlyMetric.findMany({
          where: { projectId: project.id },
          orderBy: { month: "asc" },
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  project: { owner, repo, ...project },
                  metrics,
                },
                null,
                2
              ),
            },
          ],
        };
      }
    );

    server.registerTool(
      "get_stars",
      {
        title: "Get Star History",
        description: "Get monthly cumulative star counts for a project.",
        inputSchema: {
          owner: z.string().describe("GitHub repository owner"),
          repo: z.string().describe("GitHub repository name"),
        },
      },
      async ({ owner, repo }) => {
        const project = await prisma.project.findFirst({
          where: {
            owner: { equals: owner, mode: "insensitive" },
            repo: { equals: repo, mode: "insensitive" },
          },
          select: { id: true, githubStars: true },
        });
        if (!project) {
          return {
            content: [{ type: "text", text: `Project ${owner}/${repo} not found` }],
            isError: true,
          };
        }
        const history = await prisma.starHistory.findMany({
          where: { projectId: project.id },
          orderBy: { month: "asc" },
        });
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                { totalStars: project.githubStars, history },
                null,
                2
              ),
            },
          ],
        };
      }
    );
  },
  {},
  {
    basePath: "/api/mcp",
    maxDuration: 60,
  }
);

const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;

  const hash = hashToken(bearerToken);
  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hash },
  });
  if (!apiToken) return undefined;

  // Throttled lastUsedAt update
  const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
  if (!apiToken.lastUsedAt || apiToken.lastUsedAt < fiveMinAgo) {
    prisma.apiToken
      .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
      .catch(() => {});
  }

  return {
    token: bearerToken,
    clientId: apiToken.prefix,
    scopes: [],
    extra: { tokenId: apiToken.id, name: apiToken.name },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, {
  required: true,
});

export { authHandler as GET, authHandler as POST, authHandler as DELETE };
