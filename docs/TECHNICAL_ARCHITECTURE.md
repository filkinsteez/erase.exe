# Technical Architecture

## Recommended stack

- Next.js app router for web app and API routes
- TypeScript for application code
- Server-side job worker for deletion
- Database for users, connected accounts, post index, burn bags, jobs, and audit events
- Object storage for temporary archive upload, with short retention
- AES-GCM or managed KMS for token encryption

## High level flow

```txt
Browser
  -> Next.js UI
  -> API routes
  -> Auth/session layer
  -> Database
  -> Job queue
  -> X API
```

## Important boundaries

### Client boundary

The browser may:

- Display archive data
- Let the user search and filter
- Let the user queue selections
- Collect the deletion verse
- Poll job status

The browser may not:

- Store access tokens
- Call X delete endpoint
- Invent a deletion queue that bypasses server validation
- Start live deletion without dry run and queue hash

### Server boundary

The server must:

- Own OAuth token exchange
- Encrypt tokens
- Fetch and normalize posts
- Compute queue hashes
- Validate deletion verse
- Create jobs
- Call X delete endpoint
- Write audit events

### Worker boundary

The worker must:

- Pull queued jobs
- Fetch encrypted token and decrypt in memory only
- Delete post IDs in small batches
- Persist per-post status
- Respect pause and abort
- Stop on repeated authorization errors
- Back off on transient provider errors

## Suggested modules

```txt
src/lib/oauth.ts             PKCE and authorize URL helpers
src/lib/tokenCrypto.ts       token encryption helpers
src/lib/xApi.ts              provider API calls
src/lib/deleteJobSchema.ts   destructive request validation
src/lib/verseTemplates.ts    deletion verse generation
src/lib/security.ts          confirmation helpers
src/components/*             terminal UI components
```

## Future modules

```txt
src/server/session.ts
src/server/db.ts
src/server/archiveParser.ts
src/server/queueHash.ts
src/server/deleteWorker.ts
src/server/audit.ts
src/server/rateLimit.ts
```

## Queue hash design

The queue hash should be created server-side from:

- X user ID
- Ordered provider post IDs
- Selected filters
- Burn bag ID
- Dry run ID

The hash prevents the client from changing the queue after review.

## Archive import design

Prefer a two-step flow:

1. Upload and parse archive into normalized post index.
2. Delete raw upload.

Parsed data should include only:

- Post ID
- Posted at
- Text
- Type
- Media flag
- Metrics where available

Parsed data should exclude:

- Direct messages
- Account credentials
- Contacts
- Private metadata not needed for deletion

## Deletion job design

Deletion should be asynchronous.

```txt
queued -> running -> paused -> running -> complete
queued -> running -> aborted
queued -> running -> failed
```

Pause means stop before the next batch. Abort means stop remaining work. Neither restores already deleted posts.
