import "server-only";

import { and, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { XCreditsDepletedError, xFetch } from "./xClient";
import { recordAuditEvent } from "./audit";

export type DeleteFailure = {
  providerPostId: string;
  status: number;
  error: string;
};

export type DeletePostsResult = {
  deleted: string[];
  failed: DeleteFailure[];
  creditsDepleted: boolean;
  rateLimited: boolean;
};

const MAX_PER_CALL = 50;

export async function deletePosts(params: {
  userId: string;
  connectedAccountId: string;
  providerPostIds: string[];
}): Promise<DeletePostsResult> {
  const ids = Array.from(new Set(params.providerPostIds)).slice(0, MAX_PER_CALL);
  const result: DeletePostsResult = {
    deleted: [],
    failed: [],
    creditsDepleted: false,
    rateLimited: false
  };
  if (ids.length === 0) return result;

  for (const id of ids) {
    if (result.creditsDepleted || result.rateLimited) {
      result.failed.push({
        providerPostId: id,
        status: 0,
        error: result.creditsDepleted ? "skipped_credits_depleted" : "skipped_rate_limited"
      });
      continue;
    }
    try {
      const response = await xFetch(
        params.connectedAccountId,
        `/2/tweets/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (response.ok) {
        result.deleted.push(id);
        continue;
      }
      if (response.status === 429) {
        result.rateLimited = true;
        result.failed.push({
          providerPostId: id,
          status: 429,
          error: "rate_limited"
        });
        continue;
      }
      const text = await response.text().catch(() => "");
      result.failed.push({
        providerPostId: id,
        status: response.status,
        error: text.slice(0, 200) || `http_${response.status}`
      });
    } catch (error) {
      if (error instanceof XCreditsDepletedError) {
        result.creditsDepleted = true;
        result.failed.push({
          providerPostId: id,
          status: 402,
          error: "credits_depleted"
        });
        continue;
      }
      result.failed.push({
        providerPostId: id,
        status: 0,
        error: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }

  if (result.deleted.length > 0) {
    const db = getDb();
    await db
      .delete(schema.postIndex)
      .where(
        and(
          eq(schema.postIndex.connectedAccountId, params.connectedAccountId),
          inArray(schema.postIndex.providerPostId, result.deleted)
        )
      );
    await recordAuditEvent({
      type: "posts.deleted",
      userId: params.userId,
      connectedAccountId: params.connectedAccountId,
      metadata: {
        deletedCount: result.deleted.length,
        failedCount: result.failed.length,
        creditsDepleted: result.creditsDepleted,
        rateLimited: result.rateLimited
      }
    });
  } else if (result.failed.length > 0) {
    await recordAuditEvent({
      type: "posts.delete_failed",
      userId: params.userId,
      connectedAccountId: params.connectedAccountId,
      metadata: {
        failedCount: result.failed.length,
        creditsDepleted: result.creditsDepleted,
        rateLimited: result.rateLimited
      }
    });
  }

  return result;
}

export const DELETE_MAX_PER_CALL = MAX_PER_CALL;
