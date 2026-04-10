"use client";

import type { EventMarker } from "@/lib/events";

interface TooltipPayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string;
}

interface ChartTooltipProps {
  active?: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload?: TooltipPayloadItem[];
  label?: string;
  markers: EventMarker[];
  /** Format a numeric value for display. Defaults to rounding to 1 decimal. */
  formatValue?: (v: number) => string;
}

/**
 * Custom Recharts tooltip that:
 * - Shows the event marker name if the hovered month matches one
 * - Rounds numeric values instead of showing raw floats
 */
export function ChartTooltip({
  active,
  payload,
  label,
  markers,
  formatValue = (v) => v.toFixed(1),
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  const marker = markers.find((m) => m.date === label);

  return (
    <div
      style={{
        backgroundColor: "#1F2937",
        border: "1px solid #374151",
        borderRadius: 8,
        padding: "8px 12px",
        fontSize: 12,
        color: "#F9FAFB",
      }}
    >
      <p style={{ margin: 0, fontWeight: 600, marginBottom: 4 }}>
        {label}
        {marker && (
          <span style={{ color: marker.color, marginLeft: 6, fontWeight: 400 }}>
            — {marker.label}
          </span>
        )}
      </p>
      {payload.map((item, i) => {
        const val = typeof item.value === "number" ? formatValue(item.value) : item.value;
        return (
          <p key={i} style={{ margin: 0, color: item.color }}>
            {item.name}: {val}
          </p>
        );
      })}
    </div>
  );
}
