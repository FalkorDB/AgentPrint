"use client";

interface DeltaCardProps {
  title: string;
  current: number | null;
  previous: number | null;
  format?: "number" | "percent" | "rate";
  unit?: string;
}

function formatValue(value: number | null, format: string, unit?: string): string {
  if (value === null || value === undefined) return "—";
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(1)}%`;
    case "rate":
      return value.toFixed(2);
    default:
      return `${Math.round(value).toLocaleString()}${unit ? ` ${unit}` : ""}`;
  }
}

export function DeltaCard({ title, current, previous, format = "number", unit }: DeltaCardProps) {
  let delta: number | null = null;
  let trend: "up" | "down" | "neutral" = "neutral";

  if (current !== null && previous !== null && previous !== 0) {
    delta = ((current - previous) / Math.abs(previous)) * 100;
    trend = delta > 2 ? "up" : delta < -2 ? "down" : "neutral";
  }

  const trendConfig = {
    up: { color: "text-green-400", bg: "bg-green-400/10", arrow: "↑" },
    down: { color: "text-red-400", bg: "bg-red-400/10", arrow: "↓" },
    neutral: { color: "text-gray-400", bg: "bg-gray-400/10", arrow: "→" },
  };
  const t = trendConfig[trend];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700">
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        {title}
      </p>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {formatValue(current, format, unit)}
        </span>
        {delta !== null && (
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${t.color} ${t.bg}`}>
            {t.arrow} {Math.abs(delta).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        vs 12mo ago: {formatValue(previous, format, unit)}
      </p>
    </div>
  );
}
