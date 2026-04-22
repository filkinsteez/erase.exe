# Data Model

Use this as a starting point for Prisma, Drizzle, Supabase, or another database layer.

## User

```ts
type User = {
  id: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
};
```

## ConnectedAccount

```ts
type ConnectedAccount = {
  id: string;
  userId: string;
  provider: "x";
  providerUserId: string;
  handle: string;
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  scopes: string[];
  tokenExpiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
};
```

## PostIndex

```ts
type PostIndex = {
  id: string;
  userId: string;
  connectedAccountId: string;
  providerPostId: string;
  postedAt: Date;
  type: "post" | "reply" | "repost" | "quote";
  textPreview: string;
  textEncrypted?: string;
  likeCount?: number;
  replyCount?: number;
  repostCount?: number;
  quoteCount?: number;
  hasMedia: boolean;
  source: "api" | "archive";
  createdAt: Date;
};
```

## Scan

```ts
type Scan = {
  id: string;
  userId: string;
  connectedAccountId: string;
  source: "api" | "archive" | "both";
  filters: Record<string, unknown>;
  sort: "reverse_chronological" | "oldest_first";
  count: number;
  coverage: "api_recent" | "archive_full" | "combined";
  createdAt: Date;
};
```

## BurnBag

```ts
type BurnBag = {
  id: string;
  userId: string;
  connectedAccountId: string;
  scanId: string;
  count: number;
  queueHash: string;
  status: "unsealed" | "sealed" | "armed" | "executing" | "complete" | "aborted";
  sourceSummary: string[];
  dateStart?: Date;
  dateEnd?: Date;
  createdAt: Date;
  sealedAt?: Date;
};
```

## BurnBagPost

```ts
type BurnBagPost = {
  burnBagId: string;
  postIndexId: string;
  providerPostId: string;
  status: "queued" | "spared" | "deleted" | "failed";
  failureReason?: string;
};
```

## DryRun

```ts
type DryRun = {
  id: string;
  burnBagId: string;
  queueHash: string;
  wouldDelete: number;
  sampleReviewed: boolean;
  createdAt: Date;
};
```

## DeleteJob

```ts
type DeleteJob = {
  id: string;
  burnBagId: string;
  userId: string;
  connectedAccountId: string;
  dryRunId: string;
  queueHash: string;
  status: "queued" | "running" | "paused" | "aborted" | "complete" | "failed";
  deletedCount: number;
  failedCount: number;
  remainingCount: number;
  typedVerseHash: string;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
};
```

## AuditEvent

```ts
type AuditEvent = {
  id: string;
  userId: string;
  connectedAccountId?: string;
  deleteJobId?: string;
  type: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
};
```
