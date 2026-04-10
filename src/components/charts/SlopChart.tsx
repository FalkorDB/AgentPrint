"use client";

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

interface SlopChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  markers: EventMarker[];
}

export function SlopChart({ data, markers }: SlopChartProps) {
  const visibleMarkers = markers.filter((m) =>
    data.some((d) => d.month === m.date)
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Slop Signal
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Rising rejection rate + first-time contributor ratio after AI model releases may indicate low-quality AI-generated PRs.
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 55, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
          <YAxis
            stroke="#6B7280"
            fontSize={11}
            tickLine={false}
            domain={[0, "auto"]}
            label={{ value: "%", angle: -90, position: "insideLeft", style: { fill: "#6B7280", fontSize: 11 } }}
          />
          <Tooltip content={<ChartTooltip markers={visibleMarkers} formatValue={(v) => `${v.toFixed(1)}%`} />} />
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
            dataKey="rejectionPct"
            name="PR Rejection Rate %"
            stroke="#EF4444"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="firstTimePct"
            name="First-Time Contributor %"
            stroke="#06B6D4"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
