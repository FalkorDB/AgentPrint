/** Notable AI model release dates rendered as vertical reference lines on charts */
export interface EventMarker {
  date: string; // YYYY-MM
  label: string;
  color?: string;
}

export const AI_EVENT_MARKERS: EventMarker[] = [
  { date: "2022-11", label: "ChatGPT", color: "#10B981" },
  { date: "2023-03", label: "GPT-4", color: "#3B82F6" },
  { date: "2023-07", label: "Claude 2", color: "#F59E0B" },
  { date: "2024-03", label: "Claude 3", color: "#F59E0B" },
  { date: "2024-05", label: "GPT-4o", color: "#3B82F6" },
  { date: "2024-06", label: "Claude 3.5 Sonnet", color: "#F59E0B" },
  { date: "2024-12", label: "o1", color: "#3B82F6" },
  { date: "2025-01", label: "DeepSeek R1", color: "#EF4444" },
  { date: "2025-02", label: "Claude 3.5 Sonnet (new)", color: "#F59E0B" },
  { date: "2025-04", label: "GPT-4.1", color: "#3B82F6" },
  { date: "2025-06", label: "Claude 4 Sonnet", color: "#F59E0B" },
];
