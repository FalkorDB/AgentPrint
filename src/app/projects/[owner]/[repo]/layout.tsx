import type { Metadata } from "next";

interface Props {
  params: Promise<{ owner: string; repo: string }>;
  children: React.ReactNode;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { owner, repo } = await params;
  const title = `${owner}/${repo} — AgentPrint`;
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
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default function ProjectLayout({ children }: Props) {
  return children;
}
