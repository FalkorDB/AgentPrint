"use client";

import Link from "next/link";

interface ProjectListItem {
  id: string;
  owner: string;
  repo: string;
  syncState?: {
    lastSyncAt: string | null;
  } | null;
  _count: {
    commits: number;
    pullRequests: number;
    monthlyMetrics: number;
  };
}

interface ProjectListProps {
  projects: ProjectListItem[];
  onCollect: (projectId: string) => void;
  onDelete: (projectId: string) => void;
  collectingId?: string | null;
}

export function ProjectList({
  projects,
  onCollect,
  onDelete,
  collectingId,
}: ProjectListProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No projects tracked yet</p>
        <p className="text-sm mt-1">Add a GitHub repository above to get started</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 flex items-center justify-between"
        >
          <div className="flex-1">
            <Link
              href={`/projects/${project.id}`}
              className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              {project.owner}/{project.repo}
            </Link>
            <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
              <span>{project._count.commits} commits</span>
              <span>{project._count.pullRequests} PRs</span>
              <span>{project._count.monthlyMetrics} months</span>
              {project.syncState?.lastSyncAt && (
                <span>
                  Last sync:{" "}
                  {new Date(project.syncState.lastSyncAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onCollect(project.id)}
              disabled={collectingId === project.id}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {collectingId === project.id ? "Collecting..." : "Sync & Compute"}
            </button>
            <button
              onClick={() => onDelete(project.id)}
              className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
