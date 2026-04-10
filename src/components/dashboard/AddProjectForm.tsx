"use client";

import { useState } from "react";

interface AddProjectFormProps {
  onAdd: (project: { owner: string; repo: string }) => void;
  loading?: boolean;
}

export function AddProjectForm({ onAdd, loading }: AddProjectFormProps) {
  const [repoUrl, setRepoUrl] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    // Parse owner/repo from URL or "owner/repo" format
    let owner = "";
    let repo = "";

    if (repoUrl.includes("github.com")) {
      const match = repoUrl.match(/github\.com\/([^/]+)\/([^/\s]+)/);
      if (match) {
        owner = match[1];
        repo = match[2].replace(/\.git$/, "");
      }
    } else if (repoUrl.includes("/")) {
      const parts = repoUrl.split("/");
      owner = parts[0].trim();
      repo = parts[1].trim();
    }

    if (!owner || !repo) return;

    onAdd({ owner, repo });
    setRepoUrl("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-3 items-end">
      <div className="flex-1">
        <label
          htmlFor="repo"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
        >
          Repository
        </label>
        <input
          id="repo"
          type="text"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          placeholder="owner/repo or https://github.com/owner/repo"
          className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
      </div>
      <button
        type="submit"
        disabled={loading || !repoUrl.trim()}
        className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? "Adding..." : "Track"}
      </button>
    </form>
  );
}
