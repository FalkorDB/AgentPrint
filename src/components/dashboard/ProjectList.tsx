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
}: ProjectListProps) {
  const [search, setSearch] = useState("");
  const [showAll, setShowAll] = useState(false);

  const filtered = useMemo(() => {
    if (!search.trim()) return projects;
    const q = search.toLowerCase();
    return projects.filter(
      (p) => p.owner.toLowerCase().includes(q) || p.repo.toLowerCase().includes(q)
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
            className="w-full px-4 py-2 pl-9 rounded-lg bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <Link
                    href={`/projects/${project.owner}/${project.repo}`}
                    className="text-lg font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {project.owner}/{project.repo}
                  </Link>
                  {project.impactScore !== null && project.impactScore !== undefined && (
                    <span className="ml-2 align-middle">
                      <AgentScoreBadge score={project.impactScore} confidence={project.impactConfidence} size="sm" />
                    </span>
                  )}
                  <div className="flex gap-4 mt-2 text-sm text-gray-500 dark:text-gray-400">
                    {project.githubStars != null && (
                      <span>⭐ {project.githubStars.toLocaleString()}</span>
                    )}
                    <span>{(project._count.commits || project.githubCommitCount || 0).toLocaleString()} commits</span>
                    <span>{(project._count.pullRequests || project.githubPrCount || 0).toLocaleString()} PRs</span>
                    <span>{formatAge(project.githubCreatedAt, project._count.monthlyMetrics)}</span>
                    {project.syncState?.lastSyncAt && (
                      <span>
                        Last sync:{" "}
                        {new Date(project.syncState.lastSyncAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/projects/${project.owner}/${project.repo}`}
                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    📊 Dashboard
                  </Link>
                  <button
                    onClick={() => onCollect(project.id)}
                    disabled={isSyncing}
                    className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {isSyncing ? "Syncing…" : "Sync & Compute"}
                  </button>
                  <button
                    onClick={() => onDelete(project.id)}
                    className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Remove
                  </button>
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
