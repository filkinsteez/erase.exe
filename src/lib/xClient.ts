import "server-only";

import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { decryptSecret, encryptSecret } from "./tokenCrypto";
import { recordAuditEvent } from "./audit";
import { getDataConfig } from "./config";

const TOKEN_URL = "https://api.x.com/2/oauth2/token";
const REVOKE_URL = "https://api.x.com/2/oauth2/revoke";

export class XCreditsDepletedError extends Error {
  readonly code = "x_credits_depleted";
  constructor(message = "X API credits depleted.") {
    super(message);
    this.name = "XCreditsDepletedError";
  }
}

export type XTokens = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes: string[];
  byoBearerToken?: string;
};

export type TokenExchangeResult = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function getClientCreds() {
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;
  const redirectUri = process.env.X_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("X_CLIENT_ID and X_REDIRECT_URI are required.");
  }
  return { clientId, clientSecret, redirectUri };
}

function basicAuthHeader(clientId: string, clientSecret?: string): Record<string, string> {
  if (!clientSecret) return {};
  const token = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  return { Authorization: `Basic ${token}` };
}

export async function exchangeCodeForTokens(params: {
  code: string;
  verifier: string;
}): Promise<TokenExchangeResult> {
  const { clientId, clientSecret, redirectUri } = getClientCreds();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: params.code,
    redirect_uri: redirectUri,
    code_verifier: params.verifier,
    client_id: clientId
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...basicAuthHeader(clientId, clientSecret)
    },
    body,
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Token exchange failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return (await response.json()) as TokenExchangeResult;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenExchangeResult> {
  const { clientId, clientSecret } = getClientCreds();
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId
  });
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...basicAuthHeader(clientId, clientSecret)
    },
    body,
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Token refresh failed (${response.status}): ${text.slice(0, 200)}`);
  }
  return (await response.json()) as TokenExchangeResult;
}

export async function revokeAccessToken(accessToken: string): Promise<void> {
  const { clientId, clientSecret } = getClientCreds();
  const body = new URLSearchParams({
    token: accessToken,
    token_type_hint: "access_token",
    client_id: clientId
  });
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        ...basicAuthHeader(clientId, clientSecret)
      },
      body,
      cache: "no-store"
    });
  } catch (error) {
    console.warn("[xClient] revoke call failed", error);
  }
}

async function persistTokens(
  connectedAccountId: string,
  tokens: TokenExchangeResult
): Promise<XTokens> {
  const db = getDb();
  const encryptedAccess = encryptSecret(tokens.access_token);
  const encryptedRefresh = tokens.refresh_token
    ? encryptSecret(tokens.refresh_token)
    : null;
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000)
    : null;
  const scopes = tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : [];
  await db
    .update(schema.connectedAccounts)
    .set({
      encryptedAccessToken: encryptedAccess,
      encryptedRefreshToken: encryptedRefresh,
      tokenExpiresAt: expiresAt,
      scopes,
      updatedAt: new Date()
    })
    .where(eq(schema.connectedAccounts.id, connectedAccountId));
  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: expiresAt ?? undefined,
    scopes
  };
}

export async function loadAccountTokens(connectedAccountId: string): Promise<XTokens> {
  const db = getDb();
  const row = await db.query.connectedAccounts.findFirst({
    where: eq(schema.connectedAccounts.id, connectedAccountId)
  });
  if (!row || row.revokedAt) {
    throw new Error("Connected account not found or revoked.");
  }
  return {
    accessToken: decryptSecret(row.encryptedAccessToken),
    refreshToken: row.encryptedRefreshToken ? decryptSecret(row.encryptedRefreshToken) : undefined,
    expiresAt: row.tokenExpiresAt ?? undefined,
    scopes: row.scopes ?? [],
    byoBearerToken: row.encryptedByoBearerToken
      ? decryptSecret(row.encryptedByoBearerToken)
      : undefined
  };
}

function isExpiringSoon(expiresAt?: Date): boolean {
  if (!expiresAt) return false;
  return expiresAt.getTime() - Date.now() < 60_000;
}

/**
 * Fetch against the X API for a given connected account. Handles token refresh
 * on 401 and on soon-to-expire access tokens. Tokens never leave the server.
 */
export async function xFetch(
  connectedAccountId: string,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = path.startsWith("http") ? path : `https://api.x.com${path}`;
  let tokens = await loadAccountTokens(connectedAccountId);
  const { byoKeyEnabled } = getDataConfig();
  const useByo = byoKeyEnabled && Boolean(tokens.byoBearerToken);

  const makeRequest = (accessToken: string) =>
    fetch(url, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${accessToken}`
      },
      cache: "no-store"
    });

  if (useByo) {
    const response = await makeRequest(tokens.byoBearerToken as string);
    if (!response.ok) {
      await recordAuditEvent({
        type: "xapi.request_failed",
        connectedAccountId,
        metadata: { status: response.status, url, auth: "byo" }
      });
    }
    if (response.status === 402) {
      throw new XCreditsDepletedError();
    }
    return response;
  }

  if (tokens.refreshToken && isExpiringSoon(tokens.expiresAt)) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    tokens = await persistTokens(connectedAccountId, refreshed);
  }
  let response = await makeRequest(tokens.accessToken);
  if (response.status === 401 && tokens.refreshToken) {
    try {
      const refreshed = await refreshAccessToken(tokens.refreshToken);
      tokens = await persistTokens(connectedAccountId, refreshed);
      response = await makeRequest(tokens.accessToken);
    } catch (error) {
      await recordAuditEvent({
        type: "xapi.refresh_failed",
        connectedAccountId,
        metadata: { error: error instanceof Error ? error.message : String(error) }
      });
      throw error;
    }
  }
  if (!response.ok) {
    await recordAuditEvent({
      type: "xapi.request_failed",
      connectedAccountId,
      metadata: { status: response.status, url }
    });
  }
  if (response.status === 402) {
    throw new XCreditsDepletedError();
  }
  return response;
}

export type XMeResponse = {
  data: {
    id: string;
    username: string;
    name: string;
  };
};

export async function fetchAuthenticatedUser(accessToken: string): Promise<XMeResponse["data"]> {
  const response = await fetch("https://api.x.com/2/users/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store"
  });
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`/users/me failed (${response.status}): ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as XMeResponse;
  if (!body?.data?.id || !body?.data?.username) {
    throw new Error("Malformed /users/me response.");
  }
  return body.data;
}

export async function storeInitialTokens(params: {
  connectedAccountId: string;
  tokens: TokenExchangeResult;
}): Promise<void> {
  await persistTokens(params.connectedAccountId, params.tokens);
}
