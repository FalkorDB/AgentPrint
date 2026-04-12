"use client";

import { useId } from "react";

interface ChartInfoProps {
  description: string;
}

/**
 * A small (i) icon that reveals an extended chart description on hover or focus.
 */
export function ChartInfo({ description }: ChartInfoProps) {
  const tooltipId = useId();

  return (
    <span className="group relative inline-flex items-center">
      <span
        tabIndex={0}
        role="button"
        aria-describedby={tooltipId}
        aria-label="Chart description"
        className="
          inline-flex items-center justify-center
          w-4 h-4 rounded-full
          text-[10px] font-bold leading-none
          border border-gray-400 dark:border-gray-500
          text-gray-400 dark:text-gray-500
          cursor-default select-none
          hover:border-blue-400 hover:text-blue-400
          focus:border-blue-400 focus:text-blue-400
          focus:outline-none
          dark:hover:border-blue-400 dark:hover:text-blue-400
          dark:focus:border-blue-400 dark:focus:text-blue-400
          transition-colors
        "
      >
        i
      </span>
      <span
        id={tooltipId}
        role="tooltip"
        className="
          pointer-events-none absolute z-50 bottom-full left-0 mb-2
          w-72 rounded-lg px-3 py-2
          bg-gray-900 dark:bg-gray-700
          text-xs text-gray-100 leading-relaxed
          shadow-lg border border-gray-700 dark:border-gray-600
          opacity-0 group-hover:opacity-100 group-focus-within:opacity-100
          transition-opacity duration-150
        "
      >
        {description}
      </span>
    </span>
  );
}
