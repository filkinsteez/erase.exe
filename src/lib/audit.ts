import "server-only";

import { getDb, schema } from "@/db/client";
import { newId } from "./ids";

export type AuditEventInput = {
  type: string;
  userId?: string | null;
  connectedAccountId?: string | null;
  deleteJobId?: string | null;
  metadata?: Record<string, unknown>;
};

/**
 * Record a structured audit event. This is used for every destructive or
 * auth-adjacent action. Never include raw tokens, raw archive bytes, or full
 * post text. See docs/SECURITY_REQUIREMENTS.md.
 */
export async function recordAuditEvent(input: AuditEventInput): Promise<void> {
  const safeMetadata = redactMetadata(input.metadata ?? {});
  try {
    await getDb()
      .insert(schema.auditEvents)
      .values({
        id: newId("audit"),
        userId: input.userId ?? null,
        connectedAccountId: input.connectedAccountId ?? null,
        deleteJobId: input.deleteJobId ?? null,
        type: input.type,
        metadata: safeMetadata
      });
  } catch (error) {
    // Never let audit failures block the critical path. Emit to server logs.
    console.error("[audit] failed to record event", input.type, error);
  }
}

const REDACT_KEYS = new Set([
  "accessToken",
  "refreshToken",
  "token",
  "authorization",
  "password",
  "typedVerse",
  "rawText"
]);

function redactMetadata(input: Record<string, unknown>): Record<string, unknown> {
  const output: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (REDACT_KEYS.has(key)) {
      output[key] = "[redacted]";
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      output[key] = redactMetadata(value as Record<string, unknown>);
    } else {
      output[key] = value;
    }
  }
  return output;
}
