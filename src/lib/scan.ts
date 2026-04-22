import "server-only";

import { and, asc, desc, eq, gte, ilike, inArray, lte, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/db/client";
import { XCreditsDepletedError, xFetch } from "./xClient";
import { newId } from "./ids";

export const ScanFiltersSchema = z.object({
  query: z.string().trim().max(200).optional(),
  dateStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  dateEnd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  types: z.array(z.enum(["post", "reply", "repost", "quote"])).optional(),
  includeMedia: z.boolean().optional()
});

export type ScanFilters = z.infer<typeof ScanFiltersSchema>;

export const ScanRequestSchema = z.object({
  source: z.enum(["api", "archive", "both"]).default("api"),
  filters: ScanFiltersSchema.default({}),
  sort: z.enum(["reverse_chronological", "oldest_first"]).default("reverse_chronological"),
  refresh: z.boolean().default(false)
});

export type ScanRequest = z.infer<typeof ScanRequestSchema>;

type PostType = "post" | "reply" | "repost" | "quote";

type XTimelineTweet = {
  id: string;
  text: string;
  created_at?: string;
  public_metrics?: {
    like_count?: number;
    reply_count?: number;
    retweet_count?: number;
    quote_count?: number;
  };
  referenced_tweets?: Array<{ type: "replied_to" | "retweeted" | "quoted"; id: string }>;
  attachments?: { media_keys?: string[] };
};

type XTimelineResponse = {
  data?: XTimelineTweet[];
  meta?: { next_token?: string; result_count?: number };
  errors?: Array<{ title?: string; detail?: string; status?: number }>;
};

const MAX_SCAN_PAGES = 40;
const PAGE_SIZE = 100;

function classifyType(tweet: XTimelineTweet): PostType {
  const refs = tweet.referenced_tweets ?? [];
  if (refs.some((r) => r.type === "retweeted")) return "repost";
  if (refs.some((r) => r.type === "quoted")) return "quote";
  if (refs.some((r) => r.type === "replied_to")) return "reply";
  return "post";
}

export async function fetchAndStoreUserTimeline(params: {
  userId: string;
  connectedAccountId: string;
  providerUserId: string;
}): Promise<{ fetched: number; truncated: boolean; creditsDepleted: boolean }> {
  const db = getDb();
  let nextToken: string | undefined;
  let fetched = 0;
  let truncated = false;
  const fields = [
    "tweet.fields=created_at,public_metrics,referenced_tweets,attachments",
    `max_results=${PAGE_SIZE}`
  ];

  for (let page = 0; page < MAX_SCAN_PAGES; page++) {
    const qs = [...fields];
    if (nextToken) qs.push(`pagination_token=${encodeURIComponent(nextToken)}`);
    let response: Response;
    try {
      response = await xFetch(
        params.connectedAccountId,
        `/2/users/${encodeURIComponent(params.providerUserId)}/tweets?${qs.join("&")}`,
        { method: "GET" }
      );
    } catch (error) {
      if (error instanceof XCreditsDepletedError) {
        return { fetched, truncated, creditsDepleted: true };
      }
      throw error;
    }
    if (response.status === 429) {
      truncated = true;
      break;
    }
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Timeline fetch failed (${response.status}): ${text.slice(0, 200)}`);
    }
    const body = (await response.json()) as XTimelineResponse;
    const tweets = body.data ?? [];
    if (tweets.length > 0) {
      const rows = tweets.map((tweet) => ({
        id: newId("post"),
        userId: params.userId,
        connectedAccountId: params.connectedAccountId,
        providerPostId: tweet.id,
        postedAt: tweet.created_at ? new Date(tweet.created_at) : new Date(),
        type: classifyType(tweet),
        textPreview: tweet.text.slice(0, 280),
        likeCount: tweet.public_metrics?.like_count ?? 0,
        replyCount: tweet.public_metrics?.reply_count ?? 0,
        repostCount: tweet.public_metrics?.retweet_count ?? 0,
        quoteCount: tweet.public_metrics?.quote_count ?? 0,
        hasMedia: Boolean(tweet.attachments?.media_keys?.length),
        source: "api" as const
      }));
      await db
        .insert(schema.postIndex)
        .values(rows)
        .onConflictDoUpdate({
          target: [schema.postIndex.connectedAccountId, schema.postIndex.providerPostId],
          set: {
            likeCount: sql`excluded.like_count`,
            replyCount: sql`excluded.reply_count`,
            repostCount: sql`excluded.repost_count`,
            quoteCount: sql`excluded.quote_count`,
            hasMedia: sql`excluded.has_media`,
            textPreview: sql`excluded.text_preview`
          }
        });
      fetched += tweets.length;
    }
    nextToken = body.meta?.next_token;
    if (!nextToken) break;
    if (page === MAX_SCAN_PAGES - 1) truncated = true;
  }

  return { fetched, truncated, creditsDepleted: false };
}

export type SummarizedPost = {
  id: string;
  providerPostId: string;
  postedAt: string;
  type: PostType;
  text: string;
  likes: number;
  hasMedia: boolean;
  source: "api" | "archive";
};

export type ScanExecution = {
  scanId: string;
  coverage: "api_recent" | "archive_full" | "combined";
  count: number;
  sample: SummarizedPost[];
};

function buildFilterConditions(connectedAccountId: string, filters: ScanFilters) {
  const conditions = [eq(schema.postIndex.connectedAccountId, connectedAccountId)];
  if (filters.dateStart) {
    conditions.push(gte(schema.postIndex.postedAt, new Date(`${filters.dateStart}T00:00:00Z`)));
  }
  if (filters.dateEnd) {
    conditions.push(lte(schema.postIndex.postedAt, new Date(`${filters.dateEnd}T23:59:59Z`)));
  }
  if (filters.types && filters.types.length > 0) {
    conditions.push(inArray(schema.postIndex.type, filters.types));
  }
  if (filters.query && filters.query.length > 0) {
    const needle = `%${filters.query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    conditions.push(ilike(schema.postIndex.textPreview, needle));
  }
  if (filters.includeMedia === false) {
    conditions.push(eq(schema.postIndex.hasMedia, false));
  }
  return and(...conditions);
}

export async function runScan(params: {
  userId: string;
  connectedAccountId: string;
  providerUserId: string;
  request: ScanRequest;
  allowServerApi?: boolean;
}): Promise<ScanExecution & { truncated: boolean; creditsDepleted: boolean }> {
  const db = getDb();
  let truncated = false;
  let creditsDepleted = false;
  const allowServerApi = params.allowServerApi !== false;

  if (allowServerApi && (params.request.source === "api" || params.request.source === "both")) {
    const existingCount = await db
      .select({ c: sql<number>`count(*)` })
      .from(schema.postIndex)
      .where(
        and(
          eq(schema.postIndex.connectedAccountId, params.connectedAccountId),
          eq(schema.postIndex.source, "api")
        )
      );
    const cached = Number(existingCount[0]?.c ?? 0);
    if (cached === 0 || params.request.refresh) {
      const fetchResult = await fetchAndStoreUserTimeline({
        userId: params.userId,
        connectedAccountId: params.connectedAccountId,
        providerUserId: params.providerUserId
      });
      truncated = fetchResult.truncated;
      creditsDepleted = fetchResult.creditsDepleted;
    }
  }

  const where = buildFilterConditions(params.connectedAccountId, params.request.filters);
  const order =
    params.request.sort === "oldest_first"
      ? asc(schema.postIndex.postedAt)
      : desc(schema.postIndex.postedAt);

  const [countRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.postIndex)
    .where(where);
  const count = Number(countRow?.c ?? 0);

  const sampleRows = await db.query.postIndex.findMany({
    where,
    orderBy: order,
    limit: 12
  });
  const sample: SummarizedPost[] = sampleRows.map((row) => ({
    id: row.id,
    providerPostId: row.providerPostId,
    postedAt: row.postedAt.toISOString(),
    type: row.type,
    text: row.textPreview,
    likes: row.likeCount,
    hasMedia: row.hasMedia,
    source: row.source
  }));

  const coverage: "api_recent" | "archive_full" | "combined" =
    params.request.source === "both" ? "combined" : params.request.source === "archive" ? "archive_full" : "api_recent";

  const scanId = newId("scan");
  await db.insert(schema.scans).values({
    id: scanId,
    userId: params.userId,
    connectedAccountId: params.connectedAccountId,
    source: params.request.source,
    filters: params.request.filters as Record<string, unknown>,
    sort: params.request.sort,
    count,
    coverage
  });

  return { scanId, coverage, count, sample, truncated, creditsDepleted };
}

export async function getScanPage(params: {
  scanId: string;
  connectedAccountId: string;
  cursor?: string;
  limit?: number;
}): Promise<{ items: SummarizedPost[]; nextCursor: string | null; total: number }> {
  const db = getDb();
  const scan = await db.query.scans.findFirst({
    where: and(eq(schema.scans.id, params.scanId), eq(schema.scans.connectedAccountId, params.connectedAccountId))
  });
  if (!scan) {
    return { items: [], nextCursor: null, total: 0 };
  }
  const filters = ScanFiltersSchema.parse(scan.filters ?? {});
  const where = buildFilterConditions(params.connectedAccountId, filters);
  const order =
    scan.sort === "oldest_first" ? asc(schema.postIndex.postedAt) : desc(schema.postIndex.postedAt);
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
  const offset = params.cursor ? Math.max(0, parseInt(params.cursor, 10) || 0) : 0;

  const rows = await db.query.postIndex.findMany({
    where,
    orderBy: order,
    limit: limit + 1,
    offset
  });
  const hasMore = rows.length > limit;
  const sliced = hasMore ? rows.slice(0, limit) : rows;
  const [countRow] = await db
    .select({ c: sql<number>`count(*)` })
    .from(schema.postIndex)
    .where(where);
  const total = Number(countRow?.c ?? 0);

  return {
    items: sliced.map((row) => ({
      id: row.id,
      providerPostId: row.providerPostId,
      postedAt: row.postedAt.toISOString(),
      type: row.type,
      text: row.textPreview,
      likes: row.likeCount,
      hasMedia: row.hasMedia,
      source: row.source
    })),
    nextCursor: hasMore ? String(offset + limit) : null,
    total
  };
}

export async function getArchiveRooms(
  connectedAccountId: string,
  filters: ScanFilters = {}
): Promise<Array<{ year: number; postCount: number }>> {
  const db = getDb();
  const where = buildFilterConditions(connectedAccountId, filters);
  const rows = await db
    .select({
      year: sql<number>`extract(year from ${schema.postIndex.postedAt})::int`,
      postCount: sql<number>`count(*)::int`
    })
    .from(schema.postIndex)
    .where(where)
    .groupBy(sql`extract(year from ${schema.postIndex.postedAt})`)
    .orderBy(sql`extract(year from ${schema.postIndex.postedAt})`);
  return rows.map((r) => ({ year: Number(r.year), postCount: Number(r.postCount) }));
}

export async function countPostsMatchingFilters(params: {
  connectedAccountId: string;
  filters: ScanFilters;
}): Promise<number> {
  const db = getDb();
  const where = buildFilterConditions(params.connectedAccountId, params.filters);
  const [row] = await db.select({ c: sql<number>`count(*)` }).from(schema.postIndex).where(where);
  return Number(row?.c ?? 0);
}
