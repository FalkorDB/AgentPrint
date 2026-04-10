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

interface PRHealthChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
  markers: EventMarker[];
}

export function PRHealthChart({ data, markers }: PRHealthChartProps) {
  const visibleMarkers = markers.filter((m) =>
    data.some((d) => d.month === m.date)
  );

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        PR Health
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        Median time-to-merge and time-to-close (rejected) in hours
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
          <YAxis
            stroke="#6B7280"
            fontSize={11}
            tickLine={false}
            label={{ value: "Hours", angle: -90, position: "insideLeft", style: { fill: "#6B7280", fontSize: 11 } }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1F2937",
              border: "1px solid #374151",
              borderRadius: "8px",
              color: "#F9FAFB",
              fontSize: 12,
            }}
            formatter={(value) => `${Number(value).toFixed(1)}h`}
          />
          <Legend />
          {visibleMarkers.map((m) => (
            <ReferenceLine
              key={m.date}
              x={m.date}
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
