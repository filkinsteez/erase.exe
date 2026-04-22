import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { encryptSecret } from "@/lib/tokenCrypto";
import {
  exchangeCodeForTokens,
  fetchAuthenticatedUser
} from "@/lib/xClient";
import { recordAuditEvent } from "@/lib/audit";
import { getSession } from "@/lib/session";
import { newId, newOpaqueToken } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const returnedState = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");
  const expectedState = request.cookies.get("x_oauth_state")?.value;
  const verifier = request.cookies.get("x_pkce_verifier")?.value;

  if (error) {
    return errorResponse(`OAuth rejected: ${error}`, 400);
  }
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    return errorResponse("Invalid OAuth state.", 400);
  }
  if (!code || !verifier) {
    return errorResponse("Missing authorization code or PKCE verifier.", 400);
  }

  let tokens;
  try {
    tokens = await exchangeCodeForTokens({ code, verifier });
  } catch (exchangeError) {
    await recordAuditEvent({
      type: "oauth.exchange_failed",
      metadata: { error: exchangeError instanceof Error ? exchangeError.message : String(exchangeError) }
    });
    return errorResponse("Token exchange failed.", 502);
  }

  let me;
  try {
    me = await fetchAuthenticatedUser(tokens.access_token);
  } catch (meError) {
    await recordAuditEvent({
      type: "oauth.identity_failed",
      metadata: { error: meError instanceof Error ? meError.message : String(meError) }
    });
    return errorResponse("Could not read authenticated X user.", 502);
  }

  const db = getDb();
  const existing = await db.query.connectedAccounts.findFirst({
    where: and(
      eq(schema.connectedAccounts.provider, "x"),
      eq(schema.connectedAccounts.providerUserId, me.id)
    )
  });

  const encryptedAccessToken = encryptSecret(tokens.access_token);
  const encryptedRefreshToken = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : null;
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : null;
  const scopes = tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : [];

  let userId: string;
  let connectedAccountId: string;

  if (existing) {
    userId = existing.userId;
    connectedAccountId = existing.id;
    await db
      .update(schema.connectedAccounts)
      .set({
        handle: `@${me.username}`,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        scopes,
        revokedAt: null,
        updatedAt: new Date()
      })
      .where(eq(schema.connectedAccounts.id, existing.id));
  } else {
    userId = newId("user");
    connectedAccountId = newId("acct");
    await db.transaction(async (tx) => {
      await tx.insert(schema.users).values({ id: userId });
      await tx.insert(schema.connectedAccounts).values({
        id: connectedAccountId,
        userId,
        provider: "x",
        providerUserId: me.id,
        handle: `@${me.username}`,
        encryptedAccessToken,
        encryptedRefreshToken,
        tokenExpiresAt: expiresAt,
        scopes
      });
    });
  }

  const session = await getSession();
  session.userId = userId;
  session.connectedAccountId = connectedAccountId;
  session.handle = `@${me.username}`;
  session.providerUserId = me.id;
  session.csrfToken = newOpaqueToken(24);
  await session.save();

  await recordAuditEvent({
    type: "oauth.connected",
    userId,
    connectedAccountId,
    metadata: { providerUserId: me.id, scopes }
  });

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const response = NextResponse.redirect(`${appUrl}/?connected=1`);
  response.cookies.delete("x_oauth_state");
  response.cookies.delete("x_pkce_verifier");
  return response;
}

function errorResponse(message: string, status: number) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const url = new URL(appUrl);
  url.searchParams.set("oauth_error", message);
  const response = NextResponse.redirect(url.toString(), { status: 302 });
  response.cookies.delete("x_oauth_state");
  response.cookies.delete("x_pkce_verifier");
  response.headers.set("x-error-status", String(status));
  return response;
}
