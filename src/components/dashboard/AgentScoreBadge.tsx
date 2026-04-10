"use client";

import { useState, useRef, useEffect } from "react";

interface AgentScoreBadgeProps {
  score: number;
  confidence?: string | null;
  size?: "sm" | "lg";
}

function getScoreColor(score: number): { bg: string; text: string; ring: string; label: string } {
  if (score >= 75) return { bg: "bg-green-500/15", text: "text-green-400", ring: "ring-green-500/30", label: "Very High" };
  if (score >= 50) return { bg: "bg-emerald-500/15", text: "text-emerald-400", ring: "ring-emerald-500/30", label: "High" };
  if (score >= 25) return { bg: "bg-yellow-500/15", text: "text-yellow-400", ring: "ring-yellow-500/30", label: "Moderate" };
  return { bg: "bg-red-500/15", text: "text-red-400", ring: "ring-red-500/30", label: "Low" };
}

const SCORE_BREAKDOWN = [
  { name: "Throughput Surge", max: 25, desc: "Growth in lines changed & PRs merged per dev vs baseline" },
  { name: "Slop Signal", max: 40, desc: "Rising rejection rate & first-time contributor PRs" },
  { name: "Review Shortcut", max: 20, desc: "Time-to-merge dropping while PR volume grows" },
  { name: "Consistency", max: 15, desc: "How many recent months show correlated signals" },
];

function ScoreTooltip({ score, confidence, label }: { score: number; confidence?: string | null; label: string }) {
  return (
    <div className="w-72 p-3 rounded-lg bg-gray-900 border border-gray-700 shadow-xl text-xs text-gray-300 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-white">Agent Impact Score</span>
        <span className="font-bold text-white">{score}/100</span>
      </div>
      <p className="text-gray-400 leading-snug">
        Measures how much AI coding agents have boosted this project&apos;s velocity. Higher score = greater positive impact. Compares the last 6 months against the 6–18 month baseline.
      </p>
      <div className="space-y-1.5 pt-1">
        {SCORE_BREAKDOWN.map((item) => (
          <div key={item.name}>
            <div className="flex justify-between text-gray-400">
              <span>{item.name}</span>
              <span className="text-gray-500">up to {item.max} pts</span>
            </div>
            <p className="text-gray-500 text-[10px] leading-tight">{item.desc}</p>
          </div>
        ))}
      </div>
      <div className="pt-1 border-t border-gray-700 flex items-center justify-between">
        <span className="text-gray-400">Rating: <span className="text-white font-medium">{label}</span></span>
        {confidence && (
          <span className="text-gray-500">
            {confidence} confidence
          </span>
        )}
      </div>
    </div>
  );
}

export function AgentScoreBadge({ score, confidence, size = "lg" }: AgentScoreBadgeProps) {
  const { bg, text, ring, label } = getScoreColor(score);
  const [open, setOpen] = useState(false);
  const [above, setAbove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && ref.current) {
      const rect = ref.current.getBoundingClientRect();
      setAbove(rect.bottom + 300 > window.innerHeight);
    }
  }, [open]);

  const tooltip = open && (
    <div className={`absolute z-50 left-1/2 -translate-x-1/2 ${above ? "bottom-full mb-2" : "top-full mt-2"}`}>
      <ScoreTooltip score={score} confidence={confidence} label={label} />
    </div>
  );

  if (size === "sm") {
    return (
      <span
        ref={ref as React.RefObject<HTMLSpanElement>}
        className={`relative inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text} ring-1 ${ring} cursor-help`}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        🤖 {score}
        {tooltip}
      </span>
    );
  }

  return (
    <div
      ref={ref}
      className={`relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${bg} ring-1 ${ring} cursor-help`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <span className="text-lg">🤖</span>
      <div className="flex flex-col leading-tight">
        <span className={`text-lg font-bold ${text}`}>{score}</span>
        <span className={`text-[10px] uppercase tracking-wider ${text} opacity-80`}>
          {label}
          {confidence === "low" && " · low conf"}
        </span>
      </div>
      {tooltip}
    </div>
  );
}
