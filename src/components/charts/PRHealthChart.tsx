"use client";

import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import type { EventMarker } from "@/lib/events";
import { ChartTooltip } from "./ChartTooltip";
import { StaggeredLabel } from "./StaggeredLabel";
import { ChartInfo } from "./ChartInfo";

const PR_HEALTH_DESCRIPTION =
  "Measures review-process health: median hours from PR open to merge (Time to Merge, green) and median hours from PR open to close-without-merge (Time to Close Rejected, red). Longer Time to Merge may indicate review bottlenecks or complex changes. A widening Time to Close Rejected can signal increased effort spent triaging low-quality submissions. Dashed vertical lines mark notable AI model release dates.";

interface PRHealthChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  markers: EventMarker[];
}

export function PRHealthChart({ data, markers }: PRHealthChartProps) {
  const [showMarkers, setShowMarkers] = useState(true);
  const visibleMarkers = showMarkers
    ? markers.filter((m) => data.some((d) => d.month === m.date))
    : [];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            PR Health
          </h3>
          <ChartInfo description={PR_HEALTH_DESCRIPTION} />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showMarkers}
            onChange={(e) => setShowMarkers(e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 focus:ring-offset-0 h-3.5 w-3.5"
          />
          AI models
        </label>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Median time-to-merge and time-to-close (rejected) in hours
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 55, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
          <YAxis
            stroke="#6B7280"
            fontSize={11}
            tickLine={false}
            label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fill: "#6B7280", fontSize: 11 } }}
          />
          <Tooltip content={<ChartTooltip markers={visibleMarkers} formatValue={(v) => `${v.toFixed(1)}h`} />} />
          <Legend />
          {visibleMarkers.map((m, i) => (
            <ReferenceLine
              key={m.date}
              x={m.date}
              stroke={m.color || "#6B7280"}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={<StaggeredLabel marker={m} index={i} />}
            />
          ))}
          <Line
            type="monotone"
            dataKey="medianTtmHours"
            name="Median Time to Merge"
            stroke="#10B981"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="medianTtcHours"
            name="Median Time to Close (Rejected)"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
