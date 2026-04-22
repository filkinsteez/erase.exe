# API Spec

This is a suggested internal API. It should be implemented server-side only.

## Auth

### GET /api/x/oauth/start

Starts OAuth 2.0 Authorization Code with PKCE.

Server behavior:

- Generate state.
- Generate PKCE verifier and challenge.
- Store state and verifier in secure HTTP-only cookies.
- Redirect to X authorize URL.

### GET /api/x/oauth/callback

Completes OAuth.

Server behavior:

- Validate state.
- Exchange authorization code for access token.
- Encrypt tokens at rest.
- Fetch authenticated X user identity.
- Bind token to app user session.
- Redirect to archive scan.

### POST /api/x/oauth/revoke

Revokes token and clears local credentials.

Server behavior:

- Revoke token with X where available.
- Delete encrypted token records.
- Delete pending jobs for this account.
- Return local cleanup status.

## Archive and scan

### POST /api/archive/import

Imports an X archive file or extracted post data.

Body:

```json
{
  "uploadId": "string"
}
```

Server behavior:

- Validate file size and type.
- Parse only allowlisted post data.
- Reject DMs and unrelated files.
- Normalize post IDs, dates, text, metrics, and media flags.
- Delete raw upload after parse.
- Return coverage summary.

### POST /api/posts/scan

Scans available posts from X API or imported archive.

Body:

```json
{
  "source": "api|archive|both",
  "filters": {
    "query": "hire me",
    "dateStart": "2014-01-01",
    "dateEnd": "2020-12-31",
    "types": ["post", "reply"],
    "includeMedia": true
  },
  "sort": "reverse_chronological"
}
```

Response:

```json
{
  "scanId": "scan_123",
  "coverage": "api_recent|archive_full|combined",
  "count": 2481,
  "sample": []
}
```

## Burn bag

### POST /api/burn-bags

Creates or updates a burn bag.

Body:

```json
{
  "scanId": "scan_123",
  "selectedPostIds": ["1346889436626259968"],
  "sparedPostIds": []
}
```

Response:

```json
{
  "burnBagId": "bag_123",
  "count": 2481,
  "queueHash": "sha256...",
  "summary": {
    "handle": "@username",
    "dateRange": "2014-01-01 to 2020-12-31",
    "sources": ["keyword scan: hire me"]
  }
}
```

### POST /api/burn-bags/:id/dry-run

Runs a non-destructive rehearsal.

Response:

```json
{
  "dryRunId": "dry_123",
  "wouldDelete": 2481,
  "willNotTouch": ["DMs", "likes", "bookmarks", "followers"],
  "sampleRequired": true
}
```

## Deletion jobs

### POST /api/delete-jobs

Creates a live deletion job.

Body:

```json
{
  "burnBagId": "bag_123",
  "dryRunId": "dry_123",
  "queueHash": "sha256...",
  "typedVerse": "I walked the archive...",
  "expectedLiteralLine": "Delete 2,481 posts from @username."
}
```

Server behavior:

- Validate session.
- Validate ownership.
- Validate dry run.
- Validate queue hash.
- Validate typed verse.
- Enqueue server-side job.
- Return job ID.

### GET /api/delete-jobs/:id

Returns job status.

Response:

```json
{
  "jobId": "job_123",
  "status": "running|paused|aborted|complete|failed",
  "deleted": 120,
  "failed": 0,
  "remaining": 2361
}
```

### POST /api/delete-jobs/:id/pause

Pauses remaining work.

### POST /api/delete-jobs/:id/resume

Resumes work.

### POST /api/delete-jobs/:id/abort

Aborts remaining work. Already deleted posts are not restored.

## Reports

### GET /api/reports/:jobId

Returns black box report.

Response:

```json
{
  "jobId": "job_123",
  "accountHandle": "@username",
  "deleted": 2481,
  "failed": 3,
  "spared": 14,
  "filters": {},
  "startedAt": "2026-04-20T15:00:00Z",
  "completedAt": "2026-04-20T15:12:00Z"
}
```
