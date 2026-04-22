# Implementation Plan

## Phase 1: Prototype the ritual

Goal: make the experience feel real before wiring destructive APIs.

Tasks:

1. Refine terminal UI.
2. Add archive rooms and timeline descent.
3. Add keyword, date, and type filters.
4. Add burn bag and clemency list.
5. Add random sample review.
6. Add deletion verse.
7. Add simulated purge progress.
8. Add black box report.

Acceptance criteria:

- User can complete a full mocked flow.
- Nothing can be mistaken for live deletion.
- Final confirmation includes account, count, and literal deletion sentence.

## Phase 2: Secure auth and indexing

Goal: connect accounts and scan posts without deletion.

Tasks:

1. Complete OAuth callback token exchange.
2. Encrypt tokens at rest.
3. Fetch authenticated X user identity.
4. Implement user post timeline scanning.
5. Store normalized post index.
6. Show coverage badge.
7. Add disconnect and local purge.

Acceptance criteria:

- No token reaches browser code.
- OAuth state and PKCE are validated.
- User can browse scanned posts.
- User clearly sees coverage limitations.

## Phase 3: Archive import

Goal: support deeper historical browsing.

Tasks:

1. Add secure upload flow.
2. Parse only allowlisted post data.
3. Reject unrelated archive files.
4. Delete raw archive after parsing.
5. Merge archive and API index.
6. Add archive coverage report.

Acceptance criteria:

- DMs are never parsed or displayed.
- Raw archive is purged after parse.
- User can delete parsed post IDs only after server validation.

## Phase 4: Real deletion jobs

Goal: safely delete posts in controlled batches.

Tasks:

1. Implement dry run records.
2. Implement queue hash.
3. Verify typed deletion verse server-side.
4. Create deletion job worker.
5. Delete in small batches.
6. Implement pause, resume, and abort remaining.
7. Record black box report.
8. Add retry and failure classification.

Acceptance criteria:

- No live deletion without dry run and verse.
- Jobs respect rate limits.
- User can stop remaining work.
- Audit log is complete.

## Phase 5: Polish and launch readiness

Goal: make it memorable, trustworthy, and production ready.

Tasks:

1. Accessibility pass.
2. Mobile layout pass.
3. Security review.
4. Legal and privacy policy review.
5. Error state design.
6. Loading state design.
7. User testing with deletion simulation.
8. Launch checklist.

Acceptance criteria:

- Users understand destructive consequences.
- Users describe the experience as fun and clear.
- Security requirements are met.
