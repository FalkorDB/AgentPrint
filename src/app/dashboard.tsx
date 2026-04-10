"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { AddProjectForm } from "@/components/dashboard/AddProjectForm";
import { ProjectList } from "@/components/dashboard/ProjectList";

interface Project {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  syncState?: { lastSyncAt: string | null } | null;
  _count: {
    commits: number;
    pullRequests: number;
    monthlyMetrics: number;
  };
}

interface ProgressEntry {
  step: string;
  detail?: string;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [progressLog, setProgressLog] = useState<ProgressEntry[]>([]);
  const [syncDone, setSyncDone] = useState(false);
  const [logExpanded, setLogExpanded] = useState(false);

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleAdd(proj: {
    owner: string;
    repo: string;
  }) {
    setAdding(true);
    try {
      await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(proj),
      });
      await fetchProjects();
    } finally {
      setAdding(false);
    }
  }

  /** Read SSE stream and update progress log. Returns true if sync completed successfully. */
  async function readStream(res: Response, projectId: string): Promise<boolean> {
    const reader = res.body?.getReader();
    const decoder = new TextDecoder();
    let success = false;

    if (reader) {
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.step) {
                setProgressLog((prev) => {
                  if (prev.length > 0 && prev[prev.length - 1].step === data.step) {
                    return [...prev.slice(0, -1), { step: data.step, detail: data.detail }];
                  }
                  return [...prev, { step: data.step, detail: data.detail }];
                });
              }
              if (data.done && !data.error) {
                success = true;
              }
              if (data.error) {
                setProgressLog((prev) => [...prev, { step: "❌ Error", detail: data.error }]);
              }
            } catch {
              // skip malformed lines
            }
          }
        }
      }
    }
    return success;
  }

  async function handleCollect(projectId: string) {
    setCollectingId(projectId);
    setProgressLog([]);
    setSyncDone(false);

    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const success = await readStream(res, projectId);

      await fetchProjects();
      if (success) {
        setSyncDone(true);
        setTimeout(() => router.push(`/projects/${projectId}`), 1500);
      }
    } finally {
      setCollectingId(null);
    }
  }

  async function handleDelete(projectId: string) {
    await fetch(`/api/projects?id=${projectId}`, { method: "DELETE" });
    await fetchProjects();
  }

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-10">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
          🚀 AgentPrint
        </h1>
        <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
          Measure the velocity of open-source projects on GitHub
        </p>
      </header>

      <section className="mb-10">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Track a Repository
        </h2>
        <AddProjectForm onAdd={handleAdd} loading={adding} />
      </section>

      {/* Progress panel — collapsed by default, shows only last active line */}
      {(collectingId || syncDone) && progressLog.length > 0 && (
        <section className="mb-10 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
          <button
            onClick={() => setLogExpanded((v) => !v)}
            className="w-full px-5 py-3 flex items-center justify-between text-left hover:bg-gray-750 transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              {syncDone ? (
                <span className="inline-block w-2 h-2 bg-blue-400 rounded-full flex-shrink-0" />
              ) : (
                <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0" />
              )}
              {syncDone ? (
                <span className="text-sm font-semibold text-gray-300">
                  Sync complete — redirecting to dashboard…
                </span>
              ) : (
                <span className="text-sm text-gray-200 font-mono truncate">
                  {progressLog[progressLog.length - 1].step}
                  {progressLog[progressLog.length - 1].detail && (
                    <span className="text-gray-500"> — {progressLog[progressLog.length - 1].detail}</span>
                  )}
                </span>
              )}
            </div>
            <span className="text-gray-500 text-xs flex-shrink-0 ml-3">
              {logExpanded ? "▲ collapse" : `▼ ${progressLog.length} steps`}
            </span>
          </button>

          {logExpanded && (
            <div className="px-5 pb-4 max-h-48 overflow-y-auto space-y-1 font-mono text-sm border-t border-gray-700 pt-3">
              {progressLog.map((entry, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-500 select-none">{String(i + 1).padStart(2, "\u00A0")}.</span>
                  <span className="text-gray-200">{entry.step}</span>
                  {entry.detail && (
                    <span className="text-gray-500">— {entry.detail}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
          Tracked Projects
        </h2>
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : (
          <ProjectList
            projects={projects}
            onCollect={handleCollect}
            onDelete={handleDelete}
            collectingId={collectingId}
          />
        )}
      </section>
    </main>
  );
}
