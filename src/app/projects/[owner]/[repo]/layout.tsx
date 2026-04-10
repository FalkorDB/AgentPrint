import type { Metadata } from "next";

interface Props {
  params: Promise<{ owner: string; repo: string }>;
  children: React.ReactNode;
}

async function getScore(owner: string, repo: string): Promise<number | null> {
  try {
    const { prisma } = await import("@/lib/db");
    const project = await prisma.project.findUnique({
      where: { owner_repo: { owner, repo } },
      select: { impactScore: true },
    });
    return project?.impactScore ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  const score = await getScore(owner, repo);
  const scoreText = score !== null ? ` · Score: ${score}` : "";
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
