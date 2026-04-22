import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { validateCsrf } from "@/lib/csrf";
import { httpErrorResponse, HttpError } from "@/lib/httpError";
import { scanLimiter } from "@/lib/rateLimit";
import { recordAuditEvent } from "@/lib/audit";
import { ScanRequestSchema, runScan } from "@/lib/scan";
import { getDataConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId || !session.connectedAccountId || !session.providerUserId) {
      throw new HttpError(401, "session_missing", "Connect an X account first.");
    }
    if (!(await validateCsrf(request))) {
      throw new HttpError(403, "csrf_invalid", "CSRF token missing or invalid.");
    }

    const body = await request.json().catch(() => ({}));
    const parsed = ScanRequestSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpError(400, "invalid_request", parsed.error.issues[0]?.message ?? "Invalid scan body.");
    }

    const rate = await scanLimiter.check(`scan:${session.connectedAccountId}`);
    if (!rate.success) {
      throw new HttpError(429, "rate_limited", "Too many scans. Try again later.");
    }

    if (parsed.data.source === "archive") {
      throw new HttpError(400, "unsupported", "Archive-only scans require an archive import first.");
    }

    const { serverApiEnabled } = getDataConfig();
    const result = await runScan({
      userId: session.userId,
      connectedAccountId: session.connectedAccountId,
      providerUserId: session.providerUserId,
      request: parsed.data,
      allowServerApi: serverApiEnabled
    });

    await recordAuditEvent({
      type: "scan.completed",
      userId: session.userId,
      connectedAccountId: session.connectedAccountId,
      metadata: {
        scanId: result.scanId,
        count: result.count,
        coverage: result.coverage,
        truncated: result.truncated,
        source: parsed.data.source,
        sort: parsed.data.sort,
        filters: parsed.data.filters
      }
    });

    return NextResponse.json({
      scanId: result.scanId,
      coverage: result.coverage,
      count: result.count,
      sample: result.sample,
      truncated: result.truncated,
      creditsDepleted: result.creditsDepleted
    });
  } catch (error) {
    return httpErrorResponse(error);
  }
}
