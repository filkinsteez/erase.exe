import { NextResponse } from "next/server";
import { buildXAuthorizeUrl, createOAuthState, createPkcePair } from "@/lib/oauth";

export function GET() {
  const clientId = process.env.X_CLIENT_ID;
  const redirectUri = process.env.X_REDIRECT_URI;
  const scopes = process.env.X_SCOPES ?? "tweet.read tweet.write users.read offline.access";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Missing X_CLIENT_ID or X_REDIRECT_URI. Copy .env.example to .env.local first." },
      { status: 500 }
    );
  }

  const state = createOAuthState();
  const { verifier, challenge } = createPkcePair();
  const response = NextResponse.redirect(
    buildXAuthorizeUrl({ clientId, redirectUri, scopes, state, codeChallenge: challenge })
  );

  const secure = process.env.NODE_ENV === "production";
  response.cookies.set("x_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600
  });
  response.cookies.set("x_pkce_verifier", verifier, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: 600
  });

  return response;
}
