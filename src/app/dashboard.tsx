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

export default function HomePage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);

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
    defaultBranch: string;
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
    try {
      await fetch("/api/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
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
