"use client";

import { useState } from "react";

interface CopyBadgeButtonProps {
  owner: string;
  repo: string;
}

export function CopyBadgeButton({ owner, repo }: CopyBadgeButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const origin = window.location.origin;
    const badgeUrl = `${origin}/api/projects/${owner}/${repo}/badge`;
    const projectUrl = `${origin}/projects/${owner}/${repo}`;
    const markdown = `[![AgentPrint Score](${badgeUrl})](${projectUrl})`;

    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: prompt user to copy manually
      window.prompt("Copy badge markdown:", markdown);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="px-4 py-1.5 text-xs font-medium bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
      title="Copy badge markdown for README"
    >
      {copied ? "✓ Copied!" : "Copy Badge"}
    </button>
  );
}
