import type { Metadata } from "next";
import { prisma } from "@/lib/db";

interface Props {
  params: Promise<{ owner: string; repo: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;

  let scoreText = "";
  try {
    const project = await prisma.project.findUnique({
      where: { owner_repo: { owner, repo } },
      select: { impactScore: true },
    });
    if (project?.impactScore !== null && project?.impactScore !== undefined) {
      scoreText = ` · Score: ${project.impactScore}`;
    }
  } catch {
    // DB unavailable — omit score
  }

  const title = `${owner}/${repo}${scoreText} — AgentPrint`;
  const description = `AI agent fingerprint analysis for ${owner}/${repo}. Velocity metrics, PR health, and agent impact score.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: "AgentPrint",
    },
    twitter: {
      card: "summary",
      title,
      description,
    },
  };
}

export default function ProjectLayout({ children }: Props) {
  return children;
}
