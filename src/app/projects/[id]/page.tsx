"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MetricChart } from "@/components/charts/MetricChart";
import { MetricCard } from "@/components/dashboard/MetricCard";

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

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = useCallback(async () => {
    const res = await fetch(`/api/metrics?project_id=${projectId}`);
    const data = await res.json();
    setProject(data.project);
    setMetrics(data.metrics);
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  if (loading) {
    return (
      <main className="max-w-6xl mx-auto px-6 py-10">
        <p className="text-gray-500">Loading metrics...</p>
      </main>
    );
  }

  const latest = metrics.length > 0 ? metrics[metrics.length - 1] : null;

  return (
    <main className="max-w-6xl mx-auto px-6 py-10">
      <Link
        href="/"
        className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
      >
        ← Back to Dashboard
      </Link>

      <header className="mt-4 mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {project?.owner}/{project?.repo}
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {metrics.length} months of data
        </p>
      </header>

      {/* Summary cards for latest month */}
      {latest && (
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-4">
            Latest Month: {latest.month}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            <MetricCard
              title="Active Developers"
              value={latest.activeDevs}
              subtitle={`${latest.activeCodeContributors} code contributors`}
            />
            <MetricCard
              title="Lines / Dev"
              value={latest.linesChangedPerDev}
              unit="lines"
            />
            <MetricCard
              title="PR Merge Rate / Dev"
              value={latest.prMergeRatePerDev}
              unit="PRs"
            />
            <MetricCard
              title="PR Rejection Rate"
              value={
                latest.prRejectionRate !== null
                  ? (latest.prRejectionRate * 100).toFixed(1)
                  : null
              }
              unit="%"
            />
            <MetricCard
              title="First-Time Contributors"
              value={
                latest.firstTimeContribRatio !== null
                  ? (latest.firstTimeContribRatio * 100).toFixed(1)
                  : null
              }
              unit="%"
            />
            <MetricCard
              title="Median Time to Merge"
              value={latest.medianTtmHours}
              unit="hours"
            />
            <MetricCard
              title="Median Time to Close"
              value={latest.medianTtcHours}
              unit="hours"
            />
          </div>
        </section>
      )}

      {/* Charts */}
      {metrics.length > 0 && (
        <section className="grid gap-6">
          <MetricChart
            title="Active Developers Over Time"
            data={metrics}
            dataKeys={[
              { key: "activeDevs", label: "All Active (incl. reviewers)", color: "#3B82F6" },
              { key: "activeCodeContributors", label: "Code Contributors", color: "#10B981" },
            ]}
            yAxisLabel="Developers"
          />

          <MetricChart
            title="Lines Changed per Active Developer"
            data={metrics}
            dataKeys={[
              { key: "linesChangedPerDev", label: "Lines / Dev", color: "#8B5CF6" },
            ]}
            yAxisLabel="Lines"
          />

          <MetricChart
            title="PR Merge Rate per Active Developer"
            data={metrics}
            dataKeys={[
              { key: "prMergeRatePerDev", label: "Merged PRs / Dev", color: "#F59E0B" },
            ]}
            yAxisLabel="PRs"
          />

          <div className="grid md:grid-cols-2 gap-6">
            <MetricChart
              title="PR Rejection Rate"
              data={metrics.map((m) => ({
                ...m,
                prRejectionPct: m.prRejectionRate !== null ? m.prRejectionRate * 100 : null,
              }))}
              dataKeys={[
                { key: "prRejectionPct", label: "Rejection %", color: "#EF4444" },
              ]}
              yAxisLabel="%"
            />

            <MetricChart
              title="First-Time Contributor Ratio"
              data={metrics.map((m) => ({
                ...m,
                firstTimePct: m.firstTimeContribRatio !== null ? m.firstTimeContribRatio * 100 : null,
              }))}
              dataKeys={[
                { key: "firstTimePct", label: "First-Time %", color: "#06B6D4" },
              ]}
              yAxisLabel="%"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <MetricChart
              title="Median Time to Merge"
              data={metrics}
              dataKeys={[
                { key: "medianTtmHours", label: "Hours to Merge", color: "#10B981" },
              ]}
              yAxisLabel="Hours"
            />

            <MetricChart
              title="Median Time to Close (Rejected)"
              data={metrics}
              dataKeys={[
                { key: "medianTtcHours", label: "Hours to Close", color: "#EF4444" },
              ]}
              yAxisLabel="Hours"
            />
          </div>
        </section>
      )}

      {metrics.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No metrics computed yet</p>
          <p className="text-sm mt-1">
            Go back and click &quot;Sync &amp; Compute&quot; to collect data
          </p>
        </div>
      )}
    </main>
  );
}
