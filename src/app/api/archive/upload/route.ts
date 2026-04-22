import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { validateCsrf } from "@/lib/csrf";
import { httpErrorResponse, HttpError } from "@/lib/httpError";
import { recordAuditEvent } from "@/lib/audit";
import { getDataConfig } from "@/lib/config";
import { importArchiveTweets, parseTwitterArchiveZip } from "@/lib/archiveImport";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

const MAX_BYTES = 100 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session.userId || !session.connectedAccountId) {
      throw new HttpError(401, "session_missing", "Connect an X account first.");
    }
    if (!(await validateCsrf(request))) {
      throw new HttpError(403, "csrf_invalid", "CSRF token missing or invalid.");
    }

    if (!getDataConfig().archiveUploadEnabled) {
      throw new HttpError(404, "archive_upload_disabled", "Archive upload is disabled.");
    }

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      throw new HttpError(400, "invalid_content_type", "Expected multipart/form-data.");
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      throw new HttpError(400, "file_missing", "Expected a 'file' field with a .zip upload.");
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(
        413,
        "file_too_large",
        `Archive exceeds the ${MAX_BYTES / (1024 * 1024)} MB limit. Extract data/tweets.js and re-zip, or use streaming upload (coming soon).`
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const tweets = await parseTwitterArchiveZip(buffer);
    const { imported } = await importArchiveTweets({
      userId: session.userId,
      connectedAccountId: session.connectedAccountId,
      tweets
    });

    await recordAuditEvent({
      type: "archive.imported",
      userId: session.userId,
      connectedAccountId: session.connectedAccountId,
      metadata: { imported, parsed: tweets.length, fileSize: file.size }
    });

    return NextResponse.json({ imported, parsed: tweets.length });
  } catch (error) {
    return httpErrorResponse(error);
  }
}
