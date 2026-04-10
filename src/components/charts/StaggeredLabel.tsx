"use client";

import type { EventMarker } from "@/lib/events";

interface StaggeredLabelProps {
  marker: EventMarker;
  index: number;
  // Recharts injects these props
  viewBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Renders event marker labels at staggered heights (3 rows) so they don't overlap.
 */
export function StaggeredLabel({ marker, index, viewBox }: StaggeredLabelProps) {
  if (!viewBox) return null;
  const row = index % 3;
  const yOffset = row === 0 ? -28 : row === 1 ? -16 : -4;

  return (
    <text
      x={viewBox.x}
      y={(viewBox.y ?? 0) + yOffset}
      fill={marker.color || "#6B7280"}
      fontSize={8}
      textAnchor="middle"
      fontFamily="monospace"
    >
      {marker.label}
    </text>
  );
}
