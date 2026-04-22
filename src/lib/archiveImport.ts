import "server-only";

import yauzl from "yauzl";
import { sql } from "drizzle-orm";
import { getDb, schema } from "@/db/client";
import { newId } from "./ids";

export type ArchiveTweetType = "post" | "reply" | "repost" | "quote";

export type ArchiveTweet = {
  providerPostId: string;
  postedAt: Date;
  type: ArchiveTweetType;
  text: string;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
  hasMedia: boolean;
};

type RawArchiveEntry = {
  tweet: {
    id?: string;
    id_str?: string;
    created_at?: string;
    full_text?: string;
    text?: string;
    favorite_count?: string | number;
    retweet_count?: string | number;
    reply_count?: string | number;
    quote_count?: string | number;
    in_reply_to_status_id_str?: string;
    in_reply_to_status_id?: string;
    retweeted?: boolean;
    truncated?: boolean;
    entities?: {
      media?: Array<unknown>;
    };
    extended_entities?: {
      media?: Array<unknown>;
    };
  };
};

const TWEETS_ENTRY_PATTERN = /^(?:.*\/)?data\/tweets(?:-part\d+)?\.js$/i;

export async function parseTwitterArchiveZip(buffer: Buffer): Promise<ArchiveTweet[]> {
  const entries = await extractTweetJsFiles(buffer);
  const tweets: ArchiveTweet[] = [];
  const seen = new Set<string>();
  for (const content of entries) {
    const raw = stripJsAssignment(content);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      throw new Error(
        `Failed to parse tweets.js JSON: ${error instanceof Error ? error.message : "unknown error"}`
      );
    }
    if (!Array.isArray(parsed)) {
      throw new Error("tweets.js content is not a JSON array.");
    }
    for (const entry of parsed as RawArchiveEntry[]) {
      const normalized = normalizeArchiveTweet(entry);
      if (!normalized) continue;
      if (seen.has(normalized.providerPostId)) continue;
      seen.add(normalized.providerPostId);
      tweets.push(normalized);
    }
  }
  return tweets;
}

export function stripJsAssignment(content: string): string {
  const eqIdx = content.indexOf("=");
  if (eqIdx < 0) return content.trim();
  const header = content.slice(0, eqIdx).trim();
  if (!/^window\.YTD\./i.test(header)) return content.trim();
  return content.slice(eqIdx + 1).trim();
}

export function normalizeArchiveTweet(entry: RawArchiveEntry): ArchiveTweet | null {
  const tweet = entry?.tweet;
  if (!tweet) return null;
  const id = tweet.id_str ?? tweet.id;
  if (!id) return null;
  const postedAt = tweet.created_at ? new Date(tweet.created_at) : new Date(NaN);
  if (Number.isNaN(postedAt.getTime())) return null;

  const text = (tweet.full_text ?? tweet.text ?? "").toString();
  const type = classifyArchiveType(tweet, text);

  return {
    providerPostId: String(id),
    postedAt,
    type,
    text,
    likes: toInt(tweet.favorite_count),
    replies: toInt(tweet.reply_count),
    reposts: toInt(tweet.retweet_count),
    quotes: toInt(tweet.quote_count),
    hasMedia: hasMedia(tweet)
  };
}

function classifyArchiveType(
  tweet: RawArchiveEntry["tweet"],
  text: string
): ArchiveTweetType {
  if (tweet.retweeted === true || /^RT\s+@/i.test(text)) return "repost";
  if (tweet.in_reply_to_status_id_str || tweet.in_reply_to_status_id) return "reply";
  return "post";
}

function toInt(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.floor(value));
  if (typeof value === "string") {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }
  return 0;
}

function hasMedia(tweet: RawArchiveEntry["tweet"]): boolean {
  const a = tweet.entities?.media;
  const b = tweet.extended_entities?.media;
  return (Array.isArray(a) && a.length > 0) || (Array.isArray(b) && b.length > 0);
}

async function extractTweetJsFiles(buffer: Buffer): Promise<string[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
      if (err || !zipfile) {
        reject(err ?? new Error("Failed to open archive ZIP."));
        return;
      }
      const collected: string[] = [];
      let failed = false;
      zipfile.on("entry", (entry: yauzl.Entry) => {
        if (failed) return;
        if (/\/$/.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        if (!TWEETS_ENTRY_PATTERN.test(entry.fileName)) {
          zipfile.readEntry();
          return;
        }
        zipfile.openReadStream(entry, (readErr, stream) => {
          if (readErr || !stream) {
            failed = true;
            reject(readErr ?? new Error(`Failed to read ${entry.fileName}.`));
            return;
          }
          const chunks: Buffer[] = [];
          stream.on("data", (chunk: Buffer) => chunks.push(chunk));
          stream.on("error", (streamErr) => {
            failed = true;
            reject(streamErr);
          });
          stream.on("end", () => {
            collected.push(Buffer.concat(chunks).toString("utf8"));
            zipfile.readEntry();
          });
        });
      });
      zipfile.on("end", () => {
        if (failed) return;
        if (collected.length === 0) {
          reject(new Error("No data/tweets.js file found in archive."));
          return;
        }
        resolve(collected);
      });
      zipfile.on("error", (zipErr) => {
        failed = true;
        reject(zipErr);
      });
      zipfile.readEntry();
    });
  });
}

const INSERT_BATCH_SIZE = 500;

export async function importArchiveTweets(params: {
  userId: string;
  connectedAccountId: string;
  tweets: ArchiveTweet[];
}): Promise<{ imported: number }> {
  if (params.tweets.length === 0) return { imported: 0 };
  const db = getDb();
  let imported = 0;
  for (let i = 0; i < params.tweets.length; i += INSERT_BATCH_SIZE) {
    const batch = params.tweets.slice(i, i + INSERT_BATCH_SIZE);
    const rows = batch.map((t) => ({
      id: newId("post"),
      userId: params.userId,
      connectedAccountId: params.connectedAccountId,
      providerPostId: t.providerPostId,
      postedAt: t.postedAt,
      type: t.type,
      textPreview: t.text.slice(0, 280),
      likeCount: t.likes,
      replyCount: t.replies,
      repostCount: t.reposts,
      quoteCount: t.quotes,
      hasMedia: t.hasMedia,
      source: "archive" as const
    }));
    await db
      .insert(schema.postIndex)
      .values(rows)
      .onConflictDoUpdate({
        target: [schema.postIndex.connectedAccountId, schema.postIndex.providerPostId],
        set: {
          textPreview: sql`excluded.text_preview`,
          likeCount: sql`excluded.like_count`,
          replyCount: sql`excluded.reply_count`,
          repostCount: sql`excluded.repost_count`,
          quoteCount: sql`excluded.quote_count`,
          hasMedia: sql`excluded.has_media`,
          source: sql`excluded.source`
        }
      });
    imported += rows.length;
  }
  return { imported };
}
