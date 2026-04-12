"use client";

import { useState, useEffect } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartInfo } from "./ChartInfo";

const STAR_HISTORY_DESCRIPTION =
  "Shows the cumulative count of GitHub stars over time. Stars are a widely-used proxy for project visibility and community interest. Sudden spikes often correlate with press coverage, social media attention, viral posts, or major releases. A plateau or decline may suggest reduced discovery despite ongoing development.";

interface StarHistoryChartProps {
  owner: string;
  repo: string;
}

function formatStars(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export function StarHistoryChart({ owner, repo }: StarHistoryChartProps) {
  const [data, setData] = useState<Array<{ date: string; stars: number }>>([]);
  const [totalStars, setTotalStars] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/projects/${owner}/${repo}/stars`)
      .then((r) => r.json())
      .then((json) => {
        setData(json.history ?? []);
        setTotalStars(json.totalStars ?? null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [owner, repo]);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          ⭐ Star History
        </h3>
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  if (data.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-1.5 mb-1">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          ⭐ Star History
          {totalStars !== null && (
            <span className="ml-2 text-sm font-normal text-gray-400">
              {totalStars.toLocaleString()} total
            </span>
          )}
        </h3>
        <ChartInfo description={STAR_HISTORY_DESCRIPTION} />
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Cumulative GitHub stars over time
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradStars" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#FBBF24" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#FBBF24" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="date" stroke="#6B7280" fontSize={11} tickLine={false} />
          <YAxis stroke="#FBBF24" fontSize={11} tickLine={false} tickFormatter={formatStars} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelStyle={{ color: "#9CA3AF" }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [Number(value).toLocaleString(), "Stars"]}
          />
          <Area
            type="monotone"
            dataKey="stars"
            stroke="#FBBF24"
            strokeWidth={2}
            fill="url(#gradStars)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
