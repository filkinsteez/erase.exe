import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { httpErrorResponse, HttpError } from "@/lib/httpError";
import { getScanPage } from "@/lib/scan";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.userId || !session.connectedAccountId) {
      throw new HttpError(401, "session_missing", "Connect an X account first.");
    }
    const scanId = request.nextUrl.searchParams.get("scanId");
    const cursor = request.nextUrl.searchParams.get("cursor") ?? undefined;
    const limit = Number(request.nextUrl.searchParams.get("limit") ?? "50");
    if (!scanId) {
      throw new HttpError(400, "invalid_request", "scanId is required.");
    }
    const page = await getScanPage({
      scanId,
      connectedAccountId: session.connectedAccountId,
      cursor,
      limit: Number.isFinite(limit) ? limit : 50
    });
    return NextResponse.json(page);
  } catch (error) {
    return httpErrorResponse(error);
  }
}
