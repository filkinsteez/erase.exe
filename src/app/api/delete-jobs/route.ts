import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { DeleteJobSchema, literalLineMatches } from "@/lib/deleteJobSchema";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = DeleteJobSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid delete job payload.", issues: parsed.error.flatten() }, { status: 400 });
  }

  if (!literalLineMatches(parsed.data)) {
    return NextResponse.json(
      { error: "Deletion verse failed. The final line must match the literal destructive action." },
      { status: 409 }
    );
  }

  // TODO: Check session, token ownership, dry run status, queue hash, CSRF token, and rate limits.
  // TODO: Enqueue a server-side job. Do not delete posts directly in this request.

  return NextResponse.json({
    jobId: `job_${randomUUID()}`,
    accountHandle: parsed.data.accountHandle,
    queuedPosts: parsed.data.postIds.length,
    status: "queued"
  });
}
