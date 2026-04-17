"use client";

import { useState, useEffect, useCallback } from "react";

interface TokenInfo {
  id: string;
  name: string;
  prefix: string;
  createdByEmail?: string;
  createdAt: string;
  lastUsedAt?: string;
}

export function ApiTokenManager() {
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchTokens = useCallback(async () => {
    const res = await fetch("/api/tokens");
    if (res.ok) setTokens(await res.json());
  }, []);

  useEffect(() => {
    if (open) fetchTokens();
  }, [open, fetchTokens]);

  async function handleCreate() {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewToken(data.token);
        setName("");
        await fetchTokens();
      }
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    await fetchTokens();
  }

  function copyToken() {
    if (newToken) {
      navigator.clipboard.writeText(newToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-gray-400 hover:text-gray-200 transition-colors"
        title="API Tokens"
        aria-label="Manage API Tokens"
      >
        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full max-h-[80vh] overflow-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">API Tokens</h2>
          <button
            onClick={() => { setOpen(false); setNewToken(null); }}
            className="text-gray-400 hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Use API tokens to authenticate REST API calls with <code className="text-xs bg-gray-700 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
        </p>

        {/* New token reveal */}
        {newToken && (
          <div className="mb-4 p-3 bg-green-900/30 border border-green-700 rounded">
            <p className="text-sm text-green-300 font-medium mb-1">
              ✓ Token created — copy it now, it won&apos;t be shown again
            </p>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-gray-900 text-green-300 px-2 py-1 rounded flex-1 break-all">
                {newToken}
              </code>
              <button
                onClick={copyToken}
                className="text-xs bg-green-700 hover:bg-green-600 text-white px-2 py-1 rounded shrink-0"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}

        {/* Create form */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Token name (e.g. CI pipeline)"
            className="flex-1 text-sm px-3 py-2 rounded border border-gray-600 bg-gray-700 text-white placeholder-gray-400"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            onClick={handleCreate}
            disabled={creating || !name.trim()}
            className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white rounded"
          >
            {creating ? "…" : "Create"}
          </button>
        </div>

        {/* Token list */}
        {tokens.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No API tokens yet</p>
        ) : (
          <ul className="space-y-2">
            {tokens.map((t) => (
              <li key={t.id} className="flex items-center justify-between p-2 rounded bg-gray-700/50">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-gray-200">{t.name}</span>
                  <span className="ml-2 text-xs text-gray-400 font-mono">{t.prefix}…</span>
                  <div className="text-xs text-gray-500">
                    Created {new Date(t.createdAt).toLocaleDateString()}
                    {t.lastUsedAt && ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}`}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="text-xs text-red-400 hover:text-red-300 ml-2 shrink-0"
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
