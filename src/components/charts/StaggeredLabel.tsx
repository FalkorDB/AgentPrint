"use client";

import type { EventMarker } from "@/lib/events";

interface StaggeredLabelProps {
  marker: EventMarker;
  index: number;
  // Recharts injects these props
  viewBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Renders event marker labels at alternating heights so they don't overlap.
 * Even-indexed labels sit higher, odd ones sit lower.
 */
export function StaggeredLabel({ marker, index, viewBox }: StaggeredLabelProps) {
  if (!viewBox) return null;
  const yOffset = index % 2 === 0 ? -22 : -8;

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
