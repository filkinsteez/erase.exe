import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { httpErrorResponse, HttpError } from "@/lib/httpError";
import { getArchiveRooms, ScanFiltersSchema } from "@/lib/scan";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session.connectedAccountId) {
      throw new HttpError(401, "session_missing", "Connect an X account first.");
    }
    const url = new URL(request.url);
    const raw: Record<string, unknown> = {};
    const query = url.searchParams.get("query");
    const dateStart = url.searchParams.get("dateStart");
    const dateEnd = url.searchParams.get("dateEnd");
    if (query) raw.query = query;
    if (dateStart) raw.dateStart = dateStart;
    if (dateEnd) raw.dateEnd = dateEnd;
    const filters = ScanFiltersSchema.parse(raw);
    const rooms = await getArchiveRooms(session.connectedAccountId, filters);
    return NextResponse.json({ rooms });
  } catch (error) {
    return httpErrorResponse(error);
  }
}
