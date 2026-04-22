# Cursor Master Prompt

You are working in the tweet-delete repository.

Build a secure, theatrical public post deletion app. The product should feel like a low-fi DOS archive where the user walks through old public memory before deleting anything.

Read these files first:

- `docs/PRD.md`
- `docs/EXPERIENCE_SPEC.md`
- `docs/SECURITY_REQUIREMENTS.md`
- `docs/API_SPEC.md`
- `docs/IMPLEMENTATION_PLAN.md`
- `AGENTS.md`

Current scaffold:

- Next.js app router
- TypeScript
- Plain CSS terminal UI
- Mock archive data
- OAuth route stubs
- Delete job validation stub
- Token encryption helper

Your first implementation goal:

1. Improve the mocked archive flow without wiring live deletion.
2. Add a real room detail screen with reverse chronological and oldest-first toggles.
3. Add post type filters.
4. Add a real sample review step before the deletion verse.
5. Add tests for `buildDeletionVerse`, `isDeletionVerseAccepted`, and delete job payload validation.

Rules:

- Do not add real deletion until dry run, queue hash, sample review, and server-side verse validation are complete.
- Never expose tokens to client code.
- Never let the client delete arbitrary IDs.
- Keep the final confirmation literal and exact.
- Preserve the weird terminal experience.
- Use small components and typed domain models.

When proposing code changes, explain which product requirement and security requirement each change supports.
