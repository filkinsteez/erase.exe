import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { getSession } from "@/lib/session";
import { validateCsrf } from "@/lib/csrf";
import { loadAccountTokens, revokeAccessToken } from "@/lib/xClient";
import { recordAuditEvent } from "@/lib/audit";
import { httpErrorResponse, HttpError } from "@/lib/httpError";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId || !session.connectedAccountId) {
      throw new HttpError(401, "session_missing", "No active session.");
    }
    if (!(await validateCsrf(request))) {
      throw new HttpError(403, "csrf_invalid", "CSRF token missing or invalid.");
    }

    const connectedAccountId = session.connectedAccountId;
    const userId = session.userId;

    let accessToken: string | undefined;
    try {
      accessToken = (await loadAccountTokens(connectedAccountId)).accessToken;
    } catch {
      accessToken = undefined;
    }
    if (accessToken) {
      await revokeAccessToken(accessToken);
    }

    const db = getDb();
    await db.delete(schema.connectedAccounts).where(eq(schema.connectedAccounts.id, connectedAccountId));
    await db.delete(schema.users).where(eq(schema.users.id, userId));

    await recordAuditEvent({
      type: "oauth.revoked",
      userId,
      connectedAccountId,
      metadata: {}
    });

    session.destroy();

    return NextResponse.json({ status: "severed" });
  } catch (error) {
    return httpErrorResponse(error);
  }
}
