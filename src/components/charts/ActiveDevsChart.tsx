"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { ChartTooltip } from "./ChartTooltip";

const ActiveDevsTooltip = (props: Record<string, unknown>) => (
  <ChartTooltip {...props} markers={[]} formatValue={(v) => String(Math.round(v))} />
);

interface ActiveDevsChartProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>[];
}

export function ActiveDevsChart({ data }: ActiveDevsChartProps) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-3 sm:p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
        Active Developers
      </h3>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 sm:mb-4">
        Committers vs. reviewers-only each month
      </p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.2} />
          <XAxis dataKey="month" stroke="#6B7280" fontSize={11} tickLine={false} />
          <YAxis
            stroke="#6B7280"
            fontSize={11}
            tickLine={false}
            label={{ value: "Developers", angle: -90, position: "insideLeft", style: { fill: "#6B7280", fontSize: 11 } }}
          />
          <Tooltip content={<ActiveDevsTooltip />} />
          <Legend />
          <Bar
            dataKey="committers"
            name="Committers"
            stackId="devs"
            fill="#3B82F6"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="reviewersOnly"
            name="Reviewers Only"
            stackId="devs"
            fill="#A78BFA"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
