"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ProjectSyncState, ProgressEntry } from "@/app/dashboard";
import { AgentScoreBadge } from "./AgentScoreBadge";

const DEFAULT_VISIBLE = 5;

function formatAge(createdAt?: string | null, metricMonths?: number): string {
  const months = metricMonths || (createdAt ? (() => {
    const created = new Date(createdAt);
    const now = new Date();
    return (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth());
  })() : 0);
  if (months >= 12) {
    const years = (months / 12).toFixed(1).replace(/\.0$/, "");
    return `${years} yr${years === "1" ? "" : "s"}`;
  }
  return `${months} mo`;
}

interface ProjectListItem {
  id: string;
  owner: string;
  repo: string;
  impactScore?: number | null;
  impactConfidence?: string | null;
  githubCommitCount?: number | null;
  githubPrCount?: number | null;
  githubStars?: number | null;
  githubCreatedAt?: string | null;
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
  syncStates: Record<string, ProjectSyncState>;
  readOnly?: boolean;
}

function SyncStrip({ state }: { state: ProjectSyncState }) {
  const [expanded, setExpanded] = useState(false);
  const last: ProgressEntry | undefined = state.log[state.log.length - 1];

  return (
    <div className="mt-3 -mx-5 -mb-5 bg-gray-900 border-t border-gray-700 rounded-b-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-2 flex items-center justify-between text-left hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          {state.done ? (
            <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${state.error ? "bg-red-400" : "bg-blue-400"}`} />
          ) : (
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
          )}
          {state.done && !state.error ? (
            <span className="text-xs font-semibold text-gray-300">
              Sync complete — redirecting…
            </span>
          ) : last ? (
            <span className="text-xs text-gray-300 font-mono truncate">
              {last.step}
              {last.detail && (
                <span className="text-gray-500"> — {last.detail}</span>
              )}
            </span>
          ) : (
            <span className="text-xs text-gray-400">Starting…</span>
          )}
        </div>
        <span className="text-gray-500 text-[10px] flex-shrink-0 ml-3">
          {expanded ? "▲" : `▼ ${state.log.length}`}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-3 max-h-36 overflow-y-auto space-y-0.5 font-mono text-xs border-t border-gray-700 pt-2">
          {state.log.map((entry, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-gray-500 select-none">{String(i + 1).padStart(2, "\u00A0")}.</span>
              <span className="text-gray-300">{entry.step}</span>
              {entry.detail && (
                <span className="text-gray-500">— {entry.detail}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectList({
  projects,
  onCollect,
  onDelete,
  syncStates,
  readOnly = false,
}: ProjectListProps) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) => `${p.owner}/${p.repo}`.toLowerCase().includes(q)
    );
  }, [projects, search]);

  const isSearching = search.trim().length > 0;
  const visible = isSearching || showAll ? filtered : filtered.slice(0, DEFAULT_VISIBLE);
  const hiddenCount = filtered.length - visible.length;

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <p className="text-lg">No projects tracked yet</p>
        <p className="text-sm mt-1">Add a GitHub repository above to get started</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.length > DEFAULT_VISIBLE && (
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowAll(false); }}
            placeholder="Search projects…"
            className="w-full px-4 py-2 pl-9 rounded-lg bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        </div>
      )}

      <div className="grid gap-4">
        {visible.map((project) => {
          const sync = syncStates[project.id];
          const isSyncing = sync && !sync.done;

          return (
            <div
              key={project.id}
              className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 min-w-0">
                    <Link
                      href={`/projects/${project.owner}/${project.repo}`}
                      className="block max-w-full text-base sm:text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline truncate"
                    >
                      {project.owner}/{project.repo}
                    </Link>
                    {project.impactScore !== null && project.impactScore !== undefined && (
                      <span className="align-middle">
                        <AgentScoreBadge score={project.impactScore} confidence={project.impactConfidence} size="sm" />
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-1 gap-y-1 mt-2 text-sm text-gray-500 dark:text-gray-300">
                    {project.githubStars != null && (
                      <span className="font-medium">⭐ {project.githubStars.toLocaleString()}</span>
                    )}
                    {project.githubStars != null && <span className="text-gray-600 dark:text-gray-500">·</span>}
                    <span>{(project._count.commits || project.githubCommitCount || 0).toLocaleString()} commits</span>
                    <span className="text-gray-600 dark:text-gray-500">·</span>
                    <span>{(project._count.pullRequests || project.githubPrCount || 0).toLocaleString()} PRs</span>
                    <span className="text-gray-600 dark:text-gray-500">·</span>
                    <span>{formatAge(project.githubCreatedAt, project._count.monthlyMetrics)}</span>
                    {project.syncState?.lastSyncAt && (
                      <>
                        <span className="text-gray-600 dark:text-gray-500">·</span>
                        <span>
                          Last sync:{" "}
                          {new Date(project.syncState.lastSyncAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:flex-shrink-0">
                  <Link
                    href={`/projects/${project.owner}/${project.repo}`}
                    title="View project dashboard"
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    📊 Dashboard
                  </Link>
                  {!readOnly && (
                    <>
                      <button
                        onClick={() => onCollect(project.id)}
                        disabled={isSyncing}
                        title="Sync data from GitHub and compute metrics"
                        className="flex-1 sm:flex-none sm:w-36 px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                      >
                        {isSyncing ? "Syncing…" : "Sync & Compute"}
                      </button>
                      <button
                        onClick={() => onDelete(project.id)}
                        title="Remove project"
                        aria-label="Remove project"
                        className="p-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Inline progress strip */}
              {sync && sync.log.length > 0 && (
                <SyncStrip state={sync} />
              )}
            </div>
          );
        })}
      </div>

      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(true)}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Show {hiddenCount} more project{hiddenCount !== 1 ? "s" : ""}
        </button>
      )}
      {showAll && !isSearching && filtered.length > DEFAULT_VISIBLE && (
        <button
          onClick={() => setShowAll(false)}
          className="w-full py-2 text-sm text-gray-400 hover:text-gray-200 transition-colors"
        >
          Show less
        </button>
      )}
    </div>
  );
}
