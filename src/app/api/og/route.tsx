import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const owner = searchParams.get("owner") ?? "";
  const repo = searchParams.get("repo") ?? "";
  const score = searchParams.get("score") ?? "";

  const hasProject = owner && repo;

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
          backgroundColor: "#111827",
          padding: "40px 60px",
        }}
      >
        {/* Logo */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://agentprint.falkordb.com/logo.png"
          width={160}
          height={160}
          alt="AgentPrint"
          style={{ marginBottom: hasProject ? "24px" : "32px" }}
        />

        {hasProject ? (
          <>
            {/* Project name */}
            <div
              style={{
                display: "flex",
                fontSize: "48px",
                fontWeight: 700,
                color: "#ffffff",
                textAlign: "center",
                lineHeight: 1.2,
              }}
            >
              {owner}/{repo}
            </div>

            {/* Score badge */}
            {score && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  marginTop: "20px",
                  backgroundColor: "#1f2937",
                  borderRadius: "16px",
                  padding: "12px 32px",
                  border: "2px solid #374151",
                }}
              >
                <span
                  style={{
                    fontSize: "32px",
                    fontWeight: 600,
                    color: "#9ca3af",
                  }}
                >
                  Agent Score:&nbsp;
                </span>
                <span
                  style={{
                    fontSize: "40px",
                    fontWeight: 700,
                    color: "#60a5fa",
                  }}
                >
                  {score}
                </span>
              </div>
            )}

            {/* Tagline */}
            <div
              style={{
                display: "flex",
                fontSize: "22px",
                color: "#9ca3af",
                marginTop: "24px",
                textAlign: "center",
              }}
            >
              AI agent fingerprint analysis · agentprint.falkordb.com
            </div>
          </>
        ) : (
          <>
            {/* Homepage variant */}
            <div
              style={{
                display: "flex",
                fontSize: "52px",
                fontWeight: 700,
                color: "#ffffff",
                textAlign: "center",
              }}
            >
              AgentPrint
            </div>
            <div
              style={{
                display: "flex",
                fontSize: "26px",
                color: "#9ca3af",
                marginTop: "16px",
                textAlign: "center",
                maxWidth: "800px",
              }}
            >
              Detect the fingerprint AI agents leave on code
            </div>
          </>
        )}
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
