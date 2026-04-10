/** Notable AI model release dates rendered as vertical reference lines on charts */
export interface EventMarker {
  date: string; // YYYY-MM
  label: string;
  color?: string;
}

export const AI_EVENT_MARKERS: EventMarker[] = [
  // 2022
  { date: "2022-11", label: "ChatGPT", color: "#10B981" },
  // 2023
  { date: "2023-03", label: "GPT-4", color: "#3B82F6" },
  { date: "2023-07", label: "Claude 2", color: "#F59E0B" },
  // 2024
  { date: "2024-02", label: "Gemini 1.5 Pro", color: "#A855F7" },
  { date: "2024-03", label: "Claude 3", color: "#F59E0B" },
  { date: "2024-05", label: "GPT-4o", color: "#3B82F6" },
  { date: "2024-06", label: "Claude 3.5 Sonnet", color: "#F59E0B" },
  { date: "2024-12", label: "o1", color: "#3B82F6" },
  // 2025
  { date: "2025-01", label: "DeepSeek R1", color: "#EF4444" },
  { date: "2025-02", label: "Claude 3.5 Sonnet (new)", color: "#F59E0B" },
  { date: "2025-03", label: "Gemini 2.5 Flash", color: "#A855F7" },
  { date: "2025-04", label: "o3 / GPT-4.1", color: "#3B82F6" },
  { date: "2025-05", label: "Codex", color: "#3B82F6" },
  { date: "2025-06", label: "Claude 4 Sonnet", color: "#F59E0B" },
  { date: "2025-08", label: "Claude Opus 4.1", color: "#F59E0B" },
  { date: "2025-09", label: "Claude Sonnet 4.5", color: "#F59E0B" },
  { date: "2025-11", label: "GPT-5 / Gemini 3 / Opus 4.5", color: "#3B82F6" },
  // 2026
  { date: "2026-02", label: "Opus 4.6 / Gemini 3.1 Pro", color: "#F59E0B" },
  { date: "2026-03", label: "GPT-5.4", color: "#3B82F6" },
];
