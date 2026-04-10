"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { VelocityChart } from "@/components/charts/VelocityChart";
import { RawVolumeChart } from "@/components/charts/RawVolumeChart";
import { SlopChart } from "@/components/charts/SlopChart";
import { PRHealthChart } from "@/components/charts/PRHealthChart";
import { ActiveDevsChart } from "@/components/charts/ActiveDevsChart";
import { DeltaCard } from "@/components/dashboard/DeltaCard";
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
    const res = await fetch(`/api/metrics?owner=${owner}&repo=${repo}`);
    const data = await res.json();
    setProject(data.project);
    setAllMetrics(data.metrics ?? []);
    setLoading(false);
  }, [owner, repo]);

  useEffect(() => {
    fetchMetrics();
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
    return metrics.find((m) => m.month === targetStr) ?? null;
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
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            ←
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {project?.owner}/{project?.repo}
          </h1>
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
        </div>
      )}
    </main>
  );
}
