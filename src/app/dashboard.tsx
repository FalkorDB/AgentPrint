"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useSession, signOut } from "next-auth/react";
import { AddProjectForm } from "@/components/dashboard/AddProjectForm";
import { ProjectList } from "@/components/dashboard/ProjectList";
import { ApiTokenManager } from "@/components/dashboard/ApiTokenManager";
import { LoginModal } from "@/components/dashboard/LoginModal";

interface Project {
  id: string;
  owner: string;
  repo: string;
  defaultBranch: string;
  impactScore?: number | null;
  impactConfidence?: string | null;
  githubCommitCount?: number | null;
  githubPrCount?: number | null;
  githubStars?: number | null;
  githubCreatedAt?: string | null;
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
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  // Per-project sync state keyed by projectId
  const [syncStates, setSyncStates] = useState<Record<string, ProjectSyncState>>({});
  const [loginOpen, setLoginOpen] = useState(false);
  const isAuthenticated = session?.user != null;

  const fetchProjects = useCallback(async () => {
    const res = await fetch("/api/projects");
    const data = await res.json();
    setProjects(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // On mount, check for any in-flight sync jobs and reconnect
  useEffect(() => {
    if (!projects.length || !isAuthenticated) return;
    async function checkActiveJobs() {
      for (const proj of projects) {
        try {
          const res = await fetch(`/api/projects/${proj.owner}/${proj.repo}/collect`);
          const ct = res.headers.get("content-type") ?? "";
          if (ct.includes("text/event-stream")) {
            consumeAndFinish(proj.id, proj.owner, proj.repo, res);
          }
        } catch {
          // ignore
        }
      }
    }
    checkActiveJobs();
  }, [isAuthenticated, projects.length > 0]);

  async function handleAdd(proj: { owner: string; repo: string }) {
    setAdding(true);
    try {
      const res = await fetch(`/api/projects/${proj.owner}/${proj.repo}`, {
        method: "PUT",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || `Failed to add project (${res.status})`);
        return;
      }
      await fetchProjects();
    } catch {
      alert("Network error adding project");
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

  /** Read an SSE response and pipe events into the per-project sync state */
  async function consumeStream(projectId: string, res: Response) {
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
    return success;
  }

  async function handleCollect(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;

    setSyncStates((prev) => ({
      ...prev,
      [projectId]: { log: [], done: false },
    }));

    try {
      const res = await fetch(`/api/projects/${proj.owner}/${proj.repo}/collect`, {
        method: "POST",
      });

      await consumeAndFinish(projectId, proj.owner, proj.repo, res);
    } catch {
      setSyncStates((prev) => ({
        ...prev,
        [projectId]: { ...prev[projectId], done: true, error: true },
      }));
    }
  }

  /** Consume an SSE stream and finalize sync state; redirect on success */
  async function consumeAndFinish(projectId: string, owner: string, repo: string, res: Response) {
    setSyncStates((prev) => ({
      ...prev,
      [projectId]: prev[projectId] ?? { log: [], done: false },
    }));

    const success = await consumeStream(projectId, res);

    await fetchProjects();
    setSyncStates((prev) => ({
      ...prev,
      [projectId]: { ...prev[projectId], done: true },
    }));

    if (success) {
      setTimeout(() => { window.location.href = `/projects/${owner}/${repo}`; }, 1500);
    }
  }

  async function handleDelete(projectId: string) {
    const proj = projects.find((p) => p.id === projectId);
    if (!proj) return;
    await fetch(`/api/projects/${proj.owner}/${proj.repo}`, { method: "DELETE" });
    await fetchProjects();
  }

  return (
    <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <header className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            <Image src="/logo.png" alt="AgentPrint" width={40} height={40} className="inline h-9 w-9 sm:h-10 sm:w-10 mr-1 align-middle" priority /> AgentPrint
            <a
              href="https://github.com/FalkorDB/AgentPrint"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-3 inline-block align-middle text-gray-400 hover:text-gray-200 transition-colors"
              title="View on GitHub"
            >
              <svg className="h-7 w-7 inline" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" /></svg>
            </a>
          </h1>
          <p className="mt-2 text-base sm:text-lg text-gray-600 dark:text-gray-400">
            Detect the fingerprint AI coding agents leave on open-source projects velocity
          </p>
        </div>
        {session?.user ? (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {session.user.image && (
              <img
                src={session.user.image}
                alt=""
                className="h-8 w-8 rounded-full"
                referrerPolicy="no-referrer"
              />
            )}
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {session.user.name ?? session.user.email}
            </span>
            <ApiTokenManager />
            <button
              onClick={async () => {
                await signOut({ redirect: false });
                window.location.reload();
              }}
              className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
            >
              Sign out
            </button>
          </div>
        ) : (
          <button
            onClick={() => setLoginOpen(true)}
            className="self-start flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Sign in
          </button>
        )}
      </header>

      {!isAuthenticated && (
        <section className="mb-10">
          <a
            href="https://github.com/FalkorDB/AgentPrint/issues/new?template=repo_request.yml&title=%5BRepo+Request%5D+owner%2Frepo"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-blue-500 text-blue-400 hover:bg-blue-500/10 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Request a repo to track
          </a>
          <p className="mt-2 text-sm text-gray-500">
            Opens a GitHub Issue — no sign-in required
          </p>
        </section>
      )}

      {isAuthenticated && (
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Track a Repository
          </h2>
          <AddProjectForm onAdd={handleAdd} loading={adding} />
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
            syncStates={syncStates}
            readOnly={!isAuthenticated}
          />
        )}
      </section>

      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </main>
  );
}
