# Launch Checklist

## Product

- Archive walk feels novel and complete.
- User can search by keyword, date, type, and year.
- Burn bag is clearly safe before sealing.
- Deletion verse is poetic but unambiguous.
- Black box report is useful.
- Coverage limitations are visible.

## UX safety

- No one-click deletion.
- Dry run appears before live deletion.
- Sample review appears for large queues.
- Final screen shows account handle and count.
- Final line says exactly what will be deleted.
- Pause and abort remaining are visible during live jobs.

## Security

- OAuth state validation works.
- PKCE verifier is validated.
- Tokens are encrypted at rest.
- Tokens never reach browser JavaScript.
- Destructive endpoints require auth and CSRF protection.
- Queue hash is verified.
- Archive upload parser is allowlisted.
- Raw archive files are purged.
- Logs do not contain secrets.

## Engineering

- Deletion job worker handles rate limits.
- Deletion job worker handles retries safely.
- Repeated auth failures stop the job.
- Audit events are written.
- Reports can be generated.
- Error states are tested.
- Unit tests cover verse validation and queue hashing.
- Integration tests cover dry run to job creation.

## Legal and trust

- Privacy policy explains archive handling.
- Terms explain irreversible deletion.
- User can disconnect account.
- User can purge local stored data.
- User sees what the app does not touch.
