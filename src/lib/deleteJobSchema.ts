import { z } from "zod";

export const DeleteJobSchema = z.object({
  accountHandle: z.string().regex(/^@[A-Za-z0-9_]{1,15}$/),
  postIds: z.array(z.string().regex(/^\d{1,19}$/)).min(1).max(5000),
  dryRunId: z.string().min(8),
  typedVerse: z.string().min(20),
  expectedLiteralLine: z.string().min(10)
});

export type DeleteJobPayload = z.infer<typeof DeleteJobSchema>;

export function getLastVerseLine(typedVerse: string): string {
  return typedVerse.trim().split("\n").at(-1)?.trim() ?? "";
}

export function literalLineMatches(payload: DeleteJobPayload): boolean {
  return getLastVerseLine(payload.typedVerse) === payload.expectedLiteralLine.trim();
}
