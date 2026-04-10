import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export const alt = "AgentPrint project analysis";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ owner: string; repo: string }>;
}) {
  const { owner, repo } = await params;

  const logoData = await readFile(join(process.cwd(), "public/logo-sm.png"));
  const logoBase64 = `data:image/png;base64,${logoData.toString("base64")}`;

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
          background: "#0F172A",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "24px",
            marginBottom: "24px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoBase64} alt="" width={96} height={96} />
          <span style={{ fontSize: "64px", fontWeight: 700, color: "#F8FAFC" }}>
            AgentPrint
          </span>
        </div>
        <div style={{ fontSize: "42px", color: "#94A3B8" }}>
          {owner}/{repo}
        </div>
        <div
          style={{
            fontSize: "22px",
            color: "#475569",
            marginTop: "20px",
          }}
        >
          AI Agent Impact Analysis · Velocity Metrics · PR Health
        </div>
      </div>
    ),
    { ...size }
  );
}
