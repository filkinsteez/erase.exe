import { NextResponse } from "next/server";

export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export function httpErrorResponse(error: unknown): NextResponse {
  if (error instanceof HttpError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "Unknown error";
  console.error("[httpError] unexpected", error);
  return NextResponse.json({ error: "Internal server error.", detail: message }, { status: 500 });
}
