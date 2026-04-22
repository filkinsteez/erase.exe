import "server-only";

import { cookies } from "next/headers";
import { getIronSession, type SessionOptions } from "iron-session";

export type TweetDeleteSession = {
  userId?: string;
  connectedAccountId?: string;
  handle?: string;
  providerUserId?: string;
  csrfToken?: string;
};

function getSessionOptions(): SessionOptions {
  const password = process.env.SESSION_SECRET;
  if (!password || password.length < 32) {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters. Regenerate with `openssl rand -base64 48`."
    );
  }
  return {
    password,
    cookieName: "tweet_delete_session",
    ttl: 60 * 60 * 24 * 30,
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/"
    }
  };
}

export async function getSession() {
  const store = await cookies();
  return getIronSession<TweetDeleteSession>(store, getSessionOptions());
}

export async function requireSession() {
  const session = await getSession();
  if (!session.userId || !session.connectedAccountId) {
    throw new SessionMissingError();
  }
  return session as Required<Pick<TweetDeleteSession, "userId" | "connectedAccountId">> &
    TweetDeleteSession;
}

export class SessionMissingError extends Error {
  constructor() {
    super("Session missing or account not connected.");
    this.name = "SessionMissingError";
  }
}
