import { describe, expect, it } from "vitest";
import { DeleteJobSchema, literalLineMatches } from "../deleteJobSchema";

const payload = {
  accountHandle: "@username",
  postIds: ["1346889436626259968"],
  dryRunId: "dry_123456",
  typedVerse: [
    "I walked the archive.",
    "I opened the boxes.",
    "Delete 1 posts from @username."
  ].join("\n"),
  expectedLiteralLine: "Delete 1 posts from @username."
};

describe("delete job schema", () => {
  it("accepts a valid payload", () => {
    const parsed = DeleteJobSchema.safeParse(payload);
    expect(parsed.success).toBe(true);
  });

  it("requires the literal final line to match", () => {
    expect(literalLineMatches(payload)).toBe(true);
    expect(literalLineMatches({ ...payload, expectedLiteralLine: "Delete 2 posts from @username." })).toBe(false);
  });

  it("rejects malformed handles and post IDs", () => {
    expect(DeleteJobSchema.safeParse({ ...payload, accountHandle: "username" }).success).toBe(false);
    expect(DeleteJobSchema.safeParse({ ...payload, postIds: ["abc"] }).success).toBe(false);
  });
});
