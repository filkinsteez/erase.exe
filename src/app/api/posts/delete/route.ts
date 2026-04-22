import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/session";
import { validateCsrf } from "@/lib/csrf";
import { HttpError, httpErrorResponse } from "@/lib/httpError";
import { DELETE_MAX_PER_CALL, deletePosts } from "@/lib/delete";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const BodySchema = z.object({
  postIds: z
    .array(z.string().regex(/^\d{1,19}$/))
    .min(1)
    .max(DELETE_MAX_PER_CALL)
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId || !session.connectedAccountId) {
      throw new HttpError(401, "session_missing", "Connect an X account first.");
    }
    if (!(await validateCsrf(request))) {
      throw new HttpError(403, "csrf_invalid", "CSRF token missing or invalid.");
    }
    const json = (await request.json().catch(() => null)) as unknown;
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      throw new HttpError(
        400,
        "invalid_body",
        parsed.error.issues[0]?.message ?? "Invalid body."
      );
    }

    const result = await deletePosts({
      userId: session.userId,
      connectedAccountId: session.connectedAccountId,
      providerPostIds: parsed.data.postIds
    });

    return NextResponse.json({
      deleted: result.deleted,
      failed: result.failed,
      creditsDepleted: result.creditsDepleted,
      rateLimited: result.rateLimited
    });
  } catch (error) {
    return httpErrorResponse(error);
  }
}
