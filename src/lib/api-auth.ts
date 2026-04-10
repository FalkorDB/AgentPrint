import { createHash } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

export type AuthResult =
  | { authenticated: false }
  | { authenticated: true; kind: "session"; email?: string }
  | { authenticated: true; kind: "token"; tokenId: string; prefix: string };

function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export { hashToken };

/**
 * Authenticate a request via Bearer token or session cookie.
 * Updates lastUsedAt at most once per 5 minutes to reduce DB writes.
 */
export async function apiAuth(request: NextRequest): Promise<AuthResult> {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const match = authHeader.match(/^bearer\s+(.+)$/i);
    if (match) {
      const raw = match[1].trim();
      const hash = hashToken(raw);
      const apiToken = await prisma.apiToken.findUnique({
        where: { tokenHash: hash },
      });
      if (apiToken) {
        const fiveMinAgo = new Date(Date.now() - 5 * 60_000);
        if (!apiToken.lastUsedAt || apiToken.lastUsedAt < fiveMinAgo) {
          prisma.apiToken
            .update({
              where: { id: apiToken.id },
              data: { lastUsedAt: new Date() },
            })
            .catch(() => {});
        }
        return { authenticated: true, kind: "token", tokenId: apiToken.id, prefix: apiToken.prefix };
      }
      return { authenticated: false };
    }
  }

  const session = await auth();
  if (session?.user) {
    return { authenticated: true, kind: "session", email: session.user.email ?? undefined };
  }
  return { authenticated: false };
}
