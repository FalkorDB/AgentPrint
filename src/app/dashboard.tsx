"use client";

import { useState, useEffect, useCallback } from "react";
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [progressLog, setProgressLog] = useState<ProgressEntry[]>([]);

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

  async function handleCollect(projectId: string) {
    setCollectingId(projectId);
    setProgressLog([]);

    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

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
                    // Same step name → update in place (e.g. "Fetching reviews… 6/100 → 7/100")
                    if (prev.length > 0 && prev[prev.length - 1].step === data.step) {
                      return [...prev.slice(0, -1), { step: data.step, detail: data.detail }];
                    }
                    return [...prev, { step: data.step, detail: data.detail }];
                  });
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

      await fetchProjects();
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

      {/* Progress panel */}
      {collectingId && progressLog.length > 0 && (
        <section className="mb-10 bg-gray-800 rounded-xl p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
            <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse" />
            Syncing…
          </h3>
          <div className="max-h-48 overflow-y-auto space-y-1 font-mono text-sm">
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
