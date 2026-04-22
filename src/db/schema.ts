import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex
} from "drizzle-orm/pg-core";

export const providerEnum = pgEnum("provider", ["x"]);
export const postTypeEnum = pgEnum("post_type", ["post", "reply", "repost", "quote"]);
export const postSourceEnum = pgEnum("post_source", ["api", "archive"]);
export const scanSourceEnum = pgEnum("scan_source", ["api", "archive", "both"]);
export const scanSortEnum = pgEnum("scan_sort", ["reverse_chronological", "oldest_first"]);
export const coverageEnum = pgEnum("coverage", ["api_recent", "archive_full", "combined"]);
export const burnBagStatusEnum = pgEnum("burn_bag_status", [
  "unsealed",
  "sealed",
  "armed",
  "executing",
  "complete",
  "aborted"
]);
export const burnBagPostStatusEnum = pgEnum("burn_bag_post_status", [
  "queued",
  "spared",
  "deleted",
  "failed"
]);
export const deleteJobStatusEnum = pgEnum("delete_job_status", [
  "queued",
  "running",
  "paused",
  "aborted",
  "complete",
  "failed"
]);

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
});

export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: providerEnum("provider").notNull().default("x"),
    providerUserId: text("provider_user_id").notNull(),
    handle: text("handle").notNull(),
    encryptedAccessToken: text("encrypted_access_token").notNull(),
    encryptedRefreshToken: text("encrypted_refresh_token"),
    encryptedByoBearerToken: text("encrypted_byo_bearer_token"),
    scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true })
  },
  (table) => ({
    providerIdx: uniqueIndex("connected_accounts_provider_user_idx").on(
      table.provider,
      table.providerUserId
    ),
    userIdx: index("connected_accounts_user_idx").on(table.userId)
  })
);

export const postIndex = pgTable(
  "post_index",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectedAccountId: text("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    providerPostId: text("provider_post_id").notNull(),
    postedAt: timestamp("posted_at", { withTimezone: true }).notNull(),
    type: postTypeEnum("type").notNull(),
    textPreview: text("text_preview").notNull(),
    textEncrypted: text("text_encrypted"),
    likeCount: integer("like_count").notNull().default(0),
    replyCount: integer("reply_count").notNull().default(0),
    repostCount: integer("repost_count").notNull().default(0),
    quoteCount: integer("quote_count").notNull().default(0),
    hasMedia: boolean("has_media").notNull().default(false),
    source: postSourceEnum("source").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    uniqueProviderPost: uniqueIndex("post_index_account_provider_post_idx").on(
      table.connectedAccountId,
      table.providerPostId
    ),
    accountPostedAt: index("post_index_account_posted_at_idx").on(
      table.connectedAccountId,
      table.postedAt
    )
  })
);

export const scans = pgTable(
  "scans",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectedAccountId: text("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    source: scanSourceEnum("source").notNull(),
    filters: jsonb("filters").$type<Record<string, unknown>>().notNull().default({}),
    sort: scanSortEnum("sort").notNull().default("reverse_chronological"),
    count: integer("count").notNull().default(0),
    coverage: coverageEnum("coverage").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("scans_account_idx").on(table.connectedAccountId)
  })
);

export const burnBags = pgTable(
  "burn_bags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectedAccountId: text("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    scanId: text("scan_id")
      .notNull()
      .references(() => scans.id, { onDelete: "cascade" }),
    count: integer("count").notNull().default(0),
    queueHash: text("queue_hash").notNull(),
    status: burnBagStatusEnum("status").notNull().default("unsealed"),
    sourceSummary: jsonb("source_summary").$type<string[]>().notNull().default([]),
    dateStart: timestamp("date_start", { withTimezone: true }),
    dateEnd: timestamp("date_end", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    sealedAt: timestamp("sealed_at", { withTimezone: true })
  },
  (table) => ({
    accountIdx: index("burn_bags_account_idx").on(table.connectedAccountId),
    hashIdx: uniqueIndex("burn_bags_hash_idx").on(table.connectedAccountId, table.queueHash)
  })
);

export const burnBagPosts = pgTable(
  "burn_bag_posts",
  {
    burnBagId: text("burn_bag_id")
      .notNull()
      .references(() => burnBags.id, { onDelete: "cascade" }),
    postIndexId: text("post_index_id")
      .notNull()
      .references(() => postIndex.id, { onDelete: "cascade" }),
    providerPostId: text("provider_post_id").notNull(),
    status: burnBagPostStatusEnum("status").notNull().default("queued"),
    failureReason: text("failure_reason"),
    attemptedAt: timestamp("attempted_at", { withTimezone: true })
  },
  (table) => ({
    pk: primaryKey({ columns: [table.burnBagId, table.postIndexId] }),
    statusIdx: index("burn_bag_posts_status_idx").on(table.burnBagId, table.status)
  })
);

export const dryRuns = pgTable("dry_runs", {
  id: text("id").primaryKey(),
  burnBagId: text("burn_bag_id")
    .notNull()
    .references(() => burnBags.id, { onDelete: "cascade" }),
  queueHash: text("queue_hash").notNull(),
  wouldDelete: integer("would_delete").notNull(),
  sampleReviewed: boolean("sample_reviewed").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const deleteJobs = pgTable(
  "delete_jobs",
  {
    id: text("id").primaryKey(),
    burnBagId: text("burn_bag_id")
      .notNull()
      .references(() => burnBags.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    connectedAccountId: text("connected_account_id")
      .notNull()
      .references(() => connectedAccounts.id, { onDelete: "cascade" }),
    dryRunId: text("dry_run_id")
      .notNull()
      .references(() => dryRuns.id, { onDelete: "restrict" }),
    queueHash: text("queue_hash").notNull(),
    status: deleteJobStatusEnum("status").notNull().default("queued"),
    deletedCount: integer("deleted_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    remainingCount: integer("remaining_count").notNull().default(0),
    typedVerseHash: text("typed_verse_hash").notNull(),
    lastCursor: integer("last_cursor").notNull().default(0),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    accountIdx: index("delete_jobs_account_idx").on(table.connectedAccountId),
    statusIdx: index("delete_jobs_status_idx").on(table.status)
  })
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    userId: text("user_id"),
    connectedAccountId: text("connected_account_id"),
    deleteJobId: text("delete_job_id"),
    type: text("type").notNull(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => ({
    typeIdx: index("audit_events_type_idx").on(table.type),
    createdIdx: index("audit_events_created_idx").on(table.createdAt)
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  connectedAccounts: many(connectedAccounts)
}));

export const connectedAccountsRelations = relations(connectedAccounts, ({ one, many }) => ({
  user: one(users, { fields: [connectedAccounts.userId], references: [users.id] }),
  posts: many(postIndex),
  scans: many(scans),
  burnBags: many(burnBags),
  deleteJobs: many(deleteJobs)
}));

export const postIndexRelations = relations(postIndex, ({ one }) => ({
  account: one(connectedAccounts, {
    fields: [postIndex.connectedAccountId],
    references: [connectedAccounts.id]
  })
}));

export const scansRelations = relations(scans, ({ one, many }) => ({
  account: one(connectedAccounts, {
    fields: [scans.connectedAccountId],
    references: [connectedAccounts.id]
  }),
  burnBags: many(burnBags)
}));

export const burnBagsRelations = relations(burnBags, ({ one, many }) => ({
  account: one(connectedAccounts, {
    fields: [burnBags.connectedAccountId],
    references: [connectedAccounts.id]
  }),
  scan: one(scans, { fields: [burnBags.scanId], references: [scans.id] }),
  posts: many(burnBagPosts),
  dryRuns: many(dryRuns),
  deleteJobs: many(deleteJobs)
}));

export const burnBagPostsRelations = relations(burnBagPosts, ({ one }) => ({
  burnBag: one(burnBags, { fields: [burnBagPosts.burnBagId], references: [burnBags.id] }),
  post: one(postIndex, { fields: [burnBagPosts.postIndexId], references: [postIndex.id] })
}));

export const dryRunsRelations = relations(dryRuns, ({ one }) => ({
  burnBag: one(burnBags, { fields: [dryRuns.burnBagId], references: [burnBags.id] })
}));

export const deleteJobsRelations = relations(deleteJobs, ({ one }) => ({
  burnBag: one(burnBags, { fields: [deleteJobs.burnBagId], references: [burnBags.id] }),
  account: one(connectedAccounts, {
    fields: [deleteJobs.connectedAccountId],
    references: [connectedAccounts.id]
  }),
  dryRun: one(dryRuns, { fields: [deleteJobs.dryRunId], references: [dryRuns.id] })
}));
