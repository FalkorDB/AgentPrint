import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "@/lib/db";

export const alt = "AgentPrint project analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  // Load the logo as base64
  const logoData = await readFile(join(process.cwd(), "public/logo.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

  // Fetch project data for the score
  let score: number | null = null;
  let confidence: string | null = null;
  let stars: number | null = null;
  try {
    const project = await prisma.project.findUnique({
      where: { owner_repo: { owner, repo } },
      select: { impactScore: true, impactConfidence: true, githubStars: true },
    });
    if (project) {
      score = project.impactScore;
      confidence = project.impactConfidence;
      stars = project.githubStars;
    }
  } catch {
    // DB unavailable — render without score
  }

  const scoreColor =
    score === null
      ? "#6B7280"
      : score >= 70
        ? "#EF4444"
        : score >= 40
          ? "#F59E0B"
          : "#10B981";

  const scoreLabel =
    score === null
      ? ""
      : score >= 70
        ? "High Agent Impact"
        : score >= 40
          ? "Moderate Agent Impact"
          : "Low Agent Impact";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0F172A 100%)",
          padding: "60px",
        }}
      >
        {/* Logo + Title row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "32px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoBase64} alt="" width={100} height={100} style={{ borderRadius: "20px" }} />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                fontSize: "52px",
                fontWeight: 700,
                color: "#F8FAFC",
                lineHeight: 1.1,
              }}
            >
              {owner}/{repo}
            </div>
            <div
              style={{
                fontSize: "24px",
                color: "#94A3B8",
                marginTop: "4px",
              }}
            >
              AgentPrint Analysis
            </div>
          </div>
        </div>

        {/* Score + Stats row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "48px",
            marginTop: "16px",
          }}
        >
          {score !== null && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "20px 40px",
                borderRadius: "16px",
                border: `2px solid ${scoreColor}`,
                background: "rgba(255,255,255,0.05)",
              }}
            >
              <div style={{ fontSize: "56px", fontWeight: 700, color: scoreColor }}>
                {score}
              </div>
              <div style={{ fontSize: "18px", color: scoreColor, marginTop: "4px" }}>
                {scoreLabel}
              </div>
              {confidence && (
                <div style={{ fontSize: "14px", color: "#64748B", marginTop: "2px" }}>
                  {confidence} confidence
                </div>
              )}
            </div>
          )}

          {stars !== null && stars > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "20px 40px",
                borderRadius: "16px",
                background: "rgba(255,255,255,0.05)",
                border: "2px solid #374151",
              }}
            >
              <div style={{ fontSize: "48px", fontWeight: 700, color: "#FBBF24" }}>
                ⭐ {stars >= 1000 ? `${(stars / 1000).toFixed(1)}k` : stars}
              </div>
              <div style={{ fontSize: "18px", color: "#94A3B8", marginTop: "4px" }}>
                GitHub Stars
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            fontSize: "16px",
            color: "#475569",
          }}
        >
          agentprint.falkordb.com
        </div>
      </div>
    ),
    { ...size }
  );
}
