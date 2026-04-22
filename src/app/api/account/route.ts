import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { getSession } from "@/lib/session";
import { ensureCsrfToken } from "@/lib/csrf";
import { httpErrorResponse } from "@/lib/httpError";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session.connectedAccountId) {
      return NextResponse.json({ connected: false });
    }
    const db = getDb();
    const row = await db.query.connectedAccounts.findFirst({
      where: eq(schema.connectedAccounts.id, session.connectedAccountId)
    });
    if (!row) {
      session.destroy();
      return NextResponse.json({ connected: false });
    }
    const csrfToken = await ensureCsrfToken();
    return NextResponse.json({
      connected: true,
      handle: row.handle,
      providerUserId: row.providerUserId,
      scopes: row.scopes,
      csrfToken
    });
  } catch (error) {
    return httpErrorResponse(error);
  }
}
