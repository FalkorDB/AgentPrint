"use client";

import {
  ComposedChart,
  Area,
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

interface VelocityChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  markers: EventMarker[];
}

export function VelocityChart({ data, markers }: VelocityChartProps) {
  const visibleMarkers = markers.filter((m) =>
    data.some((d) => d.month === m.date)
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Development Velocity
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Lines changed per active dev (area) · PR merge rate per dev (line)
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradLines" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
          <YAxis
            yAxisId="left"
            stroke="#8B5CF6"
            fontSize={11}
            tickLine={false}
            label={{ value: "Lines / Dev", angle: -90, position: "insideLeft", style: { fill: "#8B5CF6", fontSize: 11 } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#F59E0B"
            fontSize={11}
            tickLine={false}
            label={{ value: "PRs / Dev", angle: 90, position: "insideRight", style: { fill: "#F59E0B", fontSize: 11 } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F9FAFB",
              fontSize: 12,
            }}
          />
          <Legend />
          {visibleMarkers.map((m) => (
            <ReferenceLine
              key={m.date}
              x={m.date}
              yAxisId="left"
              stroke={m.color || "#6B7280"}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={{
                value: m.label,
                position: "top",
                fill: m.color || "#6B7280",
                fontSize: 9,
              }}
            />
          ))}
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="linesChangedPerDev"
            name="Lines / Dev"
            stroke="#8B5CF6"
            fill="url(#gradLines)"
            strokeWidth={2}
            connectNulls
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="prMergeRatePerDev"
            name="PR Merge Rate / Dev"
            stroke="#F59E0B"
            strokeWidth={2}
            dot={{ r: 2 }}
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
