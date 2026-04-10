"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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

export interface ProgressEntry {
  step: string;
  detail?: string;
}

export interface ProjectSyncState {
  log: ProgressEntry[];
  done: boolean;
  error?: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  // Per-project sync state keyed by projectId
  const [syncStates, setSyncStates] = useState<Record<string, ProjectSyncState>>({});
  const syncStatesRef = useRef(syncStates);
  syncStatesRef.current = syncStates;

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  async function handleAdd(proj: { owner: string; repo: string }) {
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

  function updateSyncLog(projectId: string, entry: ProgressEntry) {
    setSyncStates((prev) => {
      const state = prev[projectId] ?? { log: [], done: false };
      const log = [...state.log];
      // Same step name → replace last entry in-place
      if (log.length > 0 && log[log.length - 1].step === entry.step) {
        log[log.length - 1] = entry;
      } else {
        log.push(entry);
      }
      return { ...prev, [projectId]: { ...state, log } };
    });
  }

  async function handleCollect(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);

    // Initialize sync state for this project
    setSyncStates((prev) => ({
      ...prev,
      [projectId]: { log: [], done: false },
    }));

    try {
      const res = await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });

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
                  updateSyncLog(projectId, { step: data.step, detail: data.detail });
                }
                if (data.done && !data.error) success = true;
                if (data.error) {
                  updateSyncLog(projectId, { step: "\u274c Error", detail: data.error });
                  setSyncStates((prev) => ({
                    ...prev,
                    [projectId]: { ...prev[projectId], error: true },
                  }));
                }
              } catch {
                // skip malformed
              }
            }
          }
        }
      }

      await fetchProjects();
      setSyncStates((prev) => ({
        ...prev,
        [projectId]: { ...prev[projectId], done: true },
      }));

      if (success && proj) {
        setTimeout(() => router.push(`/projects/${proj.owner}/${proj.repo}`), 1500);
      }
    } catch {
      setSyncStates((prev) => ({
        ...prev,
        [projectId]: { ...prev[projectId], done: true, error: true },
      }));
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
            syncStates={syncStates}
          />
        )}
      </section>
    </main>
  );
}
