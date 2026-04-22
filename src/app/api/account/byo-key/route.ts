import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { getSession } from "@/lib/session";
import { validateCsrf } from "@/lib/csrf";
import { HttpError, httpErrorResponse } from "@/lib/httpError";
import { encryptSecret } from "@/lib/tokenCrypto";
import { recordAuditEvent } from "@/lib/audit";
import { getDataConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const BodySchema = z.object({
  bearer: z.string().trim().min(16).max(4096)
});

async function requireSession() {
  const session = await getSession();
  if (!session.userId || !session.connectedAccountId) {
    throw new HttpError(401, "session_missing", "Connect an X account first.");
  }
  return session;
}

export async function GET() {
  try {
    const session = await requireSession();
    const row = await getDb().query.connectedAccounts.findFirst({
      where: eq(schema.connectedAccounts.id, session.connectedAccountId as string),
      columns: { encryptedByoBearerToken: true }
    });
    return NextResponse.json({
      configured: Boolean(row?.encryptedByoBearerToken),
      enabled: getDataConfig().byoKeyEnabled
    });
  } catch (error) {
    return httpErrorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    const session = await requireSession();
    if (!(await validateCsrf(request))) {
      throw new HttpError(403, "csrf_invalid", "CSRF token missing or invalid.");
    }
    if (!getDataConfig().byoKeyEnabled) {
      throw new HttpError(404, "byo_key_disabled", "BYO API key is disabled.");
    }
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(400, "invalid_body", parsed.error.issues[0]?.message ?? "Invalid body.");
    }
    const encrypted = encryptSecret(parsed.data.bearer);
    await getDb()
      .update(schema.connectedAccounts)
      .set({ encryptedByoBearerToken: encrypted, updatedAt: new Date() })
      .where(eq(schema.connectedAccounts.id, session.connectedAccountId as string));
    await recordAuditEvent({
      type: "byo_key.saved",
      userId: session.userId,
      connectedAccountId: session.connectedAccountId
    });
    return NextResponse.json({ configured: true });
  } catch (error) {
    return httpErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    if (!(await validateCsrf(request))) {
      throw new HttpError(403, "csrf_invalid", "CSRF token missing or invalid.");
    }
    await getDb()
      .update(schema.connectedAccounts)
      .set({ encryptedByoBearerToken: null, updatedAt: new Date() })
      .where(eq(schema.connectedAccounts.id, session.connectedAccountId as string));
    await recordAuditEvent({
      type: "byo_key.cleared",
      userId: session.userId,
      connectedAccountId: session.connectedAccountId
    });
    return NextResponse.json({ configured: false });
  } catch (error) {
    return httpErrorResponse(error);
  }
}
