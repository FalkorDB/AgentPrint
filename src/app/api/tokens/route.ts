import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";
import { hashToken } from "@/lib/api-auth";

/**
 * @swagger
 * /api/tokens:
 *   get:
 *     summary: List API tokens
 *     description: Returns all API tokens (name, prefix, dates). Session auth only.
 *     tags: [Tokens]
 *     security:
 *       - session: []
 *     responses:
 *       200:
 *         description: Array of token metadata (never includes the raw token)
 *       401:
 *         description: Unauthorized
 *   post:
 *     summary: Create an API token
 *     description: Generates a new API token. The raw token is returned ONCE in the response. Session auth only.
 *     tags: [Tokens]
 *     security:
 *       - session: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *                 description: Human-readable label for the token
 *     responses:
 *       201:
 *         description: Token created — raw token included in response
 *       401:
 *         description: Unauthorized (session only, no bearer tokens)
 *       400:
 *         description: Missing token name
 */
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tokens = await prisma.apiToken.findMany({
    select: {
      id: true,
      name: true,
      prefix: true,
      createdByEmail: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tokens);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { name?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "Token name is required" }, { status: 400 });
  }

  const raw = `ap_${randomBytes(16).toString("hex")}`;
  const tokenHash = hashToken(raw);
  const prefix = raw.slice(0, 8);

  const token = await prisma.apiToken.create({
    data: {
      name,
      tokenHash,
      prefix,
      createdByEmail: session.user?.email ?? null,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ ...token, token: raw }, {
    status: 201,
    headers: { "Cache-Control": "no-store" },
  });
}
