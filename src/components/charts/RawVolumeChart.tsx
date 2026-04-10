"use client";

import {
  ComposedChart,
  Bar,
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

interface RawVolumeChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  markers: EventMarker[];
}

export function RawVolumeChart({ data, markers }: RawVolumeChartProps) {
  const visibleMarkers = markers.filter((m) =>
    data.some((d) => d.month === m.date)
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Raw Volume
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Total lines changed (bar) · Total PRs merged (line) — not normalized per developer
      </p>
      <ResponsiveContainer width="100%" height={350}>
        <ComposedChart data={data} margin={{ top: 40, right: 30, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="gradRawLines" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#6366F1" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#6366F1" stopOpacity={0.1} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
          <YAxis
            yAxisId="left"
            stroke="#6366F1"
            fontSize={11}
            tickLine={false}
            label={{ value: "Lines Changed", angle: -90, position: "insideLeft", style: { fill: "#6366F1", fontSize: 11 } }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="#F59E0B"
            fontSize={11}
            tickLine={false}
            label={{ value: "PRs Merged", angle: 90, position: "insideRight", style: { fill: "#F59E0B", fontSize: 11 } }}
          />
          <Tooltip
            content={
              <ChartTooltip
                markers={visibleMarkers}
                formatValue={(v) => Math.round(v).toLocaleString()}
              />
            }
          />
          <Legend />
          {visibleMarkers.map((m, i) => (
            <ReferenceLine
              key={m.date}
              x={m.date}
              yAxisId="left"
              stroke={m.color || "#6B7280"}
              strokeDasharray="4 4"
              strokeOpacity={0.7}
              label={<StaggeredLabel marker={m} index={i} />}
            />
          ))}
          <Bar
            yAxisId="left"
            dataKey="totalLinesChanged"
            name="Total Lines Changed"
            fill="url(#gradRawLines)"
            radius={[3, 3, 0, 0]}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="totalPrsMerged"
            name="Total PRs Merged"
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
