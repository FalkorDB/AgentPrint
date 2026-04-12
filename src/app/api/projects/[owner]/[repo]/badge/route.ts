import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

function getScoreColor(score: number): string {
  if (score >= 75) return "#22c55e"; // green-500
  if (score >= 50) return "#10b981"; // emerald-500
  if (score >= 25) return "#eab308"; // yellow-500
  return "#ef4444"; // red-500
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "very high";
  if (score >= 50) return "high";
  if (score >= 25) return "moderate";
  return "low";
}

/**
 * Approximate text pixel width for Verdana 11px.
 * Uses a simple per-character average multiplied by a scale factor.
 */
function textWidth(text: string): number {
  // Average character width in Verdana 11px is roughly 6.5px
  return Math.round(text.length * 6.5);
}

function buildSvg(owner: string, repo: string, score: number): string {
  const leftLabel = "agentprint";
  const rightLabel = `${score}/100 · ${getScoreLabel(score)}`;
  const color = getScoreColor(score);

  const leftTextWidth = textWidth(leftLabel);
  const rightTextWidth = textWidth(rightLabel);

  const leftPad = 10;
  const rightPad = 10;

  const leftSectionWidth = leftTextWidth + leftPad * 2;
  const rightSectionWidth = rightTextWidth + rightPad * 2;
  const totalWidth = leftSectionWidth + rightSectionWidth;

  // SVG text uses scale(0.1) trick: coordinates are 10× the visual position
  const leftTextX = Math.round((leftSectionWidth / 2) * 10);
  const rightTextX = Math.round((leftSectionWidth + rightSectionWidth / 2) * 10);
  const leftTextLength = leftTextWidth * 10;
  const rightTextLength = rightTextWidth * 10;

  const title = `AgentPrint score for ${owner}/${repo}: ${score}/100`;

  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${totalWidth}" height="20" role="img" aria-label="${title}">
  <title>${title}</title>
  <linearGradient id="s" x2="0" y2="100%">
    <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
    <stop offset="1" stop-opacity=".1"/>
  </linearGradient>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftSectionWidth}" height="20" fill="#555"/>
    <rect x="${leftSectionWidth}" width="${rightSectionWidth}" height="20" fill="${color}"/>
    <rect width="${totalWidth}" height="20" fill="url(#s)"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    <text aria-hidden="true" x="${leftTextX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${leftTextLength}" lengthAdjust="spacing">${leftLabel}</text>
    <text x="${leftTextX}" y="140" transform="scale(.1)" textLength="${leftTextLength}" lengthAdjust="spacing">${leftLabel}</text>
    <text aria-hidden="true" x="${rightTextX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${rightTextLength}" lengthAdjust="spacing">${rightLabel}</text>
    <text x="${rightTextX}" y="140" transform="scale(.1)" textLength="${rightTextLength}" lengthAdjust="spacing">${rightLabel}</text>
  </g>
</svg>`;
}

function buildNotFoundSvg(): string {
  const label = "agentprint";
  const value = "not tracked";
  const leftTextWidth = textWidth(label);
  const rightTextWidth = textWidth(value);
  const leftSectionWidth = leftTextWidth + 20;
  const rightSectionWidth = rightTextWidth + 20;
  const totalWidth = leftSectionWidth + rightSectionWidth;
  const leftTextX = Math.round((leftSectionWidth / 2) * 10);
  const rightTextX = Math.round((leftSectionWidth + rightSectionWidth / 2) * 10);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="20" role="img" aria-label="agentprint: not tracked">
  <title>agentprint: not tracked</title>
  <clipPath id="r">
    <rect width="${totalWidth}" height="20" rx="3" fill="#fff"/>
  </clipPath>
  <g clip-path="url(#r)">
    <rect width="${leftSectionWidth}" height="20" fill="#555"/>
    <rect x="${leftSectionWidth}" width="${rightSectionWidth}" height="20" fill="#9ca3af"/>
  </g>
  <g fill="#fff" text-anchor="middle" font-family="DejaVu Sans,Verdana,Geneva,sans-serif" font-size="110">
    <text x="${leftTextX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${leftTextWidth * 10}" lengthAdjust="spacing">${label}</text>
    <text x="${leftTextX}" y="140" transform="scale(.1)" textLength="${leftTextWidth * 10}" lengthAdjust="spacing">${label}</text>
    <text x="${rightTextX}" y="150" fill="#010101" fill-opacity=".3" transform="scale(.1)" textLength="${rightTextWidth * 10}" lengthAdjust="spacing">${value}</text>
    <text x="${rightTextX}" y="140" transform="scale(.1)" textLength="${rightTextWidth * 10}" lengthAdjust="spacing">${value}</text>
  </g>
</svg>`;
}

/**
 * @swagger
 * /api/projects/{owner}/{repo}/badge:
 *   get:
 *     summary: Get SVG badge for a project
 *     description: Returns an SVG badge showing the project's AgentPrint score. Public endpoint suitable for embedding in GitHub READMEs.
 *     tags: [Projects]
 *     parameters:
 *       - name: owner
 *         in: path
 *         required: true
 *         schema: { type: string }
 *       - name: repo
 *         in: path
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: SVG badge image
 *         content:
 *           image/svg+xml:
 *             schema:
 *               type: string
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ owner: string; repo: string }> }
) {
  const { owner, repo } = await params;

  const project = await prisma.project.findFirst({
    where: {
      owner: { equals: owner, mode: "insensitive" },
      repo: { equals: repo, mode: "insensitive" },
    },
    select: { owner: true, repo: true, impactScore: true },
  });

  const headers = {
    "Content-Type": "image/svg+xml",
    "Cache-Control": "public, max-age=3600, s-maxage=3600",
    "Access-Control-Allow-Origin": "*",
  };

  if (!project || project.impactScore === null) {
    return new NextResponse(buildNotFoundSvg(), { headers });
  }

  const svg = buildSvg(project.owner, project.repo, project.impactScore);
  return new NextResponse(svg, { headers });
}
