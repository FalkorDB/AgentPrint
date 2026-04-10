"use client";

interface AgentScoreBadgeProps {
  score: number;
  confidence?: string | null;
  size?: "sm" | "lg";
}

function getScoreColor(score: number): { bg: string; text: string; ring: string; label: string } {
  if (score >= 75) return { bg: "bg-red-500/15", text: "text-red-400", ring: "ring-red-500/30", label: "Very High" };
  if (score >= 50) return { bg: "bg-orange-500/15", text: "text-orange-400", ring: "ring-orange-500/30", label: "High" };
  if (score >= 25) return { bg: "bg-yellow-500/15", text: "text-yellow-400", ring: "ring-yellow-500/30", label: "Moderate" };
  return { bg: "bg-green-500/15", text: "text-green-400", ring: "ring-green-500/30", label: "Low" };
}

export function AgentScoreBadge({ score, confidence, size = "lg" }: AgentScoreBadgeProps) {
  const { bg, text, ring, label } = getScoreColor(score);

  if (size === "sm") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${bg} ${text} ring-1 ${ring}`}
        title={`Agent Impact Score: ${score}/100 (${label})${confidence ? ` · ${confidence} confidence` : ""}`}
      >
        🤖 {score}
      </span>
    );
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl ${bg} ring-1 ${ring}`}
      title={confidence ? `${confidence} confidence` : undefined}
    >
      <span className="text-lg">🤖</span>
      <div className="flex flex-col leading-tight">
        <span className={`text-lg font-bold ${text}`}>{score}</span>
        <span className={`text-[10px] uppercase tracking-wider ${text} opacity-80`}>
          {label}
          {confidence === "low" && " · low conf"}
        </span>
      </div>
    </div>
  );
}
