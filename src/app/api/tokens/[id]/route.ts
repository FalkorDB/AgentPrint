import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { auth } from "@/auth";

/**
 * @swagger
 * /api/tokens/{id}:
 *   delete:
 *     summary: Revoke an API token
 *     description: Permanently deletes an API token. Session auth only.
 *     tags: [Tokens]
 *     security:
 *       - session: []
 *     parameters:
 *       - name: id
 *         in: path
 *         required: true
 *         schema: { type: string }
 *         description: Token ID
 *     responses:
 *       200:
 *         description: Token revoked
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Token not found
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    await prisma.apiToken.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Token not found" }, { status: 404 });
  }
}
