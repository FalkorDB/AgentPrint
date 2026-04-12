"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VelocityChart } from "@/components/charts/VelocityChart";
import { RawVolumeChart } from "@/components/charts/RawVolumeChart";
import { SlopChart } from "@/components/charts/SlopChart";
import { PRHealthChart } from "@/components/charts/PRHealthChart";
import { ActiveDevsChart } from "@/components/charts/ActiveDevsChart";
import { StarHistoryChart } from "@/components/charts/StarHistoryChart";
import { DeltaCard } from "@/components/dashboard/DeltaCard";
import { AgentScoreBadge } from "@/components/dashboard/AgentScoreBadge";
import { CopyBadgeButton } from "@/components/dashboard/CopyBadgeButton";
import { AI_EVENT_MARKERS } from "@/lib/events";

interface MetricData {
  month: string;
  activeDevs: number;
  activeCodeContributors: number;
  linesChangedPerDev: number | null;
  prMergeRatePerDev: number | null;
  prRejectionRate: number | null;
  firstTimeContribRatio: number | null;
  medianTtmHours: number | null;
  medianTtcHours: number | null;
}

interface ProjectInfo {
  owner: string;
  repo: string;
  impactScore: number | null;
  impactConfidence: string | null;
}

const RANGE_OPTIONS = [
  { label: "12 mo", months: 12 },
  { label: "24 mo", months: 24 },
  { label: "36 mo", months: 36 },
  { label: "All", months: 0 },
];

export default function ProjectDetailPage() {
  const params = useParams();
  const owner = (params.owner as string).toLowerCase();
  const repo = (params.repo as string).toLowerCase();

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [allMetrics, setAllMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);
  const [rangeMonths, setRangeMonths] = useState(24);

  const fetchMetrics = useCallback(async () => {
    const res = await fetch(`/api/projects/${owner}/${repo}/metrics`);
    const data = await res.json();
    setProject(data.project);
    setAllMetrics(data.metrics ?? []);
    setLoading(false);
  }, [owner, repo]);

  useEffect(() => {
    fetchMetrics(); // eslint-disable-line react-hooks/set-state-in-effect
  }, [fetchMetrics]);

  // Filter metrics by date range
  const metrics = useMemo(() => {
    if (rangeMonths === 0 || allMetrics.length === 0) return allMetrics;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - rangeMonths);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}`;
    return allMetrics.filter((m) => m.month >= cutoffStr);
  }, [allMetrics, rangeMonths]);

  // Prepare chart data
  const chartData = useMemo(
    () =>
      metrics.map((m) => ({
        ...m,
        rejectionPct: m.prRejectionRate !== null ? m.prRejectionRate * 100 : null,
        firstTimePct: m.firstTimeContribRatio !== null ? m.firstTimeContribRatio * 100 : null,
        committers: m.activeCodeContributors,
        reviewersOnly: m.activeDevs - m.activeCodeContributors,
        totalLinesChanged:
          m.linesChangedPerDev !== null ? Math.round(m.linesChangedPerDev * m.activeDevs) : null,
        totalPrsMerged:
          m.prMergeRatePerDev !== null ? Math.round(m.prMergeRatePerDev * m.activeDevs) : null,
      })),
    [metrics]
  );

  // Summary: latest vs 12 months ago (skip months with no active devs)
  const latest = useMemo(() => {
    for (let i = metrics.length - 1; i >= 0; i--) {
      if (metrics[i].activeDevs > 0) return metrics[i];
    }
    return null;
  }, [metrics]);
  const prev12 = useMemo(() => {
    if (!latest || metrics.length < 2) return null;
    const target = new Date(`${latest.month}-01`);
    target.setMonth(target.getMonth() - 12);
    const targetStr = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, "0")}`;
    // Find exact match first, then closest month with data within ±2 months
    const withData = metrics.filter((m) => m.activeDevs > 0 && m.month !== latest.month);
    const exact = withData.find((m) => m.month === targetStr);
    if (exact) return exact;
    let best: MetricData | null = null;
    let bestDist = Infinity;
    for (const m of withData) {
      const dist = Math.abs(
        (new Date(`${m.month}-01`).getTime() - new Date(`${targetStr}-01`).getTime()) /
        (30 * 24 * 60 * 60 * 1000)
      );
      if (dist < bestDist && dist <= 2) {
        bestDist = dist;
        best = m;
      }
    }
    return best;
  }, [metrics, latest]);

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-6 py-10">
        <p className="text-gray-500">Loading metrics…</p>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-6 py-8">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
            title="AgentPrint Home"
          >
            <img src="/logo.png" alt="AgentPrint" className="h-7 w-7" />
          </Link>
          <a
            href="https://github.com/FalkorDB/AgentPrint"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-gray-200 transition-colors"
            title="AgentPrint on GitHub"
          >
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" /></svg>
          </a>
          <span className="text-gray-600">|</span>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {project?.owner}/{project?.repo}
            <a
              href={`https://github.com/${project?.owner}/${project?.repo}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 inline-block align-middle text-gray-400 hover:text-gray-200 transition-colors"
              title="View on GitHub"
            >
              <svg className="h-5 w-5 inline" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .3a12 12 0 0 0-3.8 23.38c.6.12.83-.26.83-.57L9 21.07c-3.34.72-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.08-.74.09-.73.09-.73 1.2.09 1.84 1.24 1.84 1.24 1.07 1.83 2.8 1.3 3.49 1 .1-.78.42-1.3.76-1.6-2.67-.31-5.47-1.34-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.14-.3-.54-1.52.1-3.18 0 0 1-.32 3.3 1.23a11.5 11.5 0 0 1 6.02 0c2.28-1.55 3.29-1.23 3.29-1.23.64 1.66.24 2.88.12 3.18a4.65 4.65 0 0 1 1.23 3.22c0 4.61-2.8 5.62-5.48 5.92.42.36.81 1.1.81 2.22l-.01 3.29c0 .31.2.69.82.57A12 12 0 0 0 12 .3" /></svg>
            </a>
          </h1>
          {project?.impactScore !== null && project?.impactScore !== undefined && (
            <AgentScoreBadge score={project.impactScore} confidence={project.impactConfidence} />
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Date range selector */}
          <div className="flex rounded-lg border border-gray-600 overflow-hidden">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.months}
                onClick={() => setRangeMonths(opt.months)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeMonths === opt.months
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <button
            onClick={fetchMetrics}
            className="px-4 py-1.5 text-xs font-medium bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors"
          >
            ↻ Refresh
          </button>

          {project && (
            <CopyBadgeButton owner={project.owner} repo={project.repo} />
          )}
        </div>
      </div>

      {metrics.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <p className="text-lg">No metrics computed yet</p>
          <p className="text-sm mt-1">
            Go back and click &quot;Sync &amp; Compute&quot; to collect data
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary strip — 4 delta cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <DeltaCard
              title="Lines Changed / Dev"
              current={latest?.linesChangedPerDev ?? null}
              previous={prev12?.linesChangedPerDev ?? null}
              unit="lines"
            />
            <DeltaCard
              title="PR Merge Rate / Dev"
              current={latest?.prMergeRatePerDev ?? null}
              previous={prev12?.prMergeRatePerDev ?? null}
              format="rate"
            />
            <DeltaCard
              title="PR Rejection Rate"
              current={latest?.prRejectionRate ?? null}
              previous={prev12?.prRejectionRate ?? null}
              format="percent"
            />
            <DeltaCard
              title="First-Time Contributors"
              current={latest?.firstTimeContribRatio ?? null}
              previous={prev12?.firstTimeContribRatio ?? null}
              format="percent"
            />
          </div>

          {/* Development Velocity — area + line, dual Y-axis */}
          <VelocityChart data={chartData} markers={AI_EVENT_MARKERS} />

          {/* Raw Volume — total lines + total PRs (not normalized) */}
          <RawVolumeChart data={chartData} markers={AI_EVENT_MARKERS} />

          {/* Slop Signal — rejection rate + first-time contributor */}
          <SlopChart data={chartData} markers={AI_EVENT_MARKERS} />

          {/* PR Health — TTM + TTC */}
          <PRHealthChart data={chartData} markers={AI_EVENT_MARKERS} />

          {/* Active Developers — stacked bar */}
          <ActiveDevsChart data={chartData} />

          {/* Star History */}
          <StarHistoryChart owner={owner} repo={repo} />
        </div>
      )}
    </main>
  );
}
