import "server-only";

import { getSession } from "./session";
import { newOpaqueToken } from "./ids";

const HEADER = "x-tweet-delete-csrf";

export async function ensureCsrfToken(): Promise<string> {
  const session = await getSession();
  if (!session.csrfToken) {
    session.csrfToken = newOpaqueToken(24);
    await session.save();
  }
  return session.csrfToken;
}

export async function validateCsrf(request: Request): Promise<boolean> {
  const session = await getSession();
  if (!session.csrfToken) return false;
  const header = request.headers.get(HEADER);
  if (!header) return false;
  return timingSafeEqual(header, session.csrfToken);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export const CSRF_HEADER = HEADER;
