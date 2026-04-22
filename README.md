# tweet-delete

tweet-delete is a low-fi DOS style archive walk for deleting public tweets. The utility is tweet cleanup. The product is the ritual: explore the archive, collect posts into a burn bag, type a deletion poem, then execute a clearly destructive action.

This repository is Cursor-ready. It includes product docs, Cursor project rules, security requirements, API notes, and a working mocked Next.js UI scaffold.

## What is included

- A Next.js and TypeScript prototype
- A haunted terminal interface
- Archive rooms by year
- Keyword and date signal scanning
- Burn bag queue mechanics
- Sample review cards
- Deletion verse confirmation
- Simulated purge progress with pause and abort
- OAuth 2.0 PKCE route stubs
- Server-side deletion job validation stub
- Token encryption helper
- Product and security docs
- Cursor rules under `.cursor/rules`

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment setup

Copy `.env.example` to `.env.local`.

```bash
cp .env.example .env.local
```

For a real X integration, fill in the OAuth variables. The UI is mocked by default. The OAuth routes are scaffolds and intentionally stop before storing tokens or deleting posts.

## Suggested Cursor flow

1. Open this folder in Cursor.
2. Read `docs/PRD.md`, `docs/EXPERIENCE_SPEC.md`, and `docs/SECURITY_REQUIREMENTS.md`.
3. Use `prompts/CURSOR_MASTER_PROMPT.md` as the first agent prompt.
4. Ask Cursor to implement features in the order listed in `docs/IMPLEMENTATION_PLAN.md`.
5. Keep all destructive functionality behind server-side checks, dry runs, explicit confirmation, and rate-limited jobs.

## Non-negotiables

- Never ask users for their X password.
- Never expose OAuth tokens to the browser.
- Never delete without a dry run, visible count, account handle, sample review, typed deletion verse, and queue hash verification.
- Never make destructive actions one-click.
- Always provide pause and abort for remaining work.
- Always show what is being deleted and what is not being touched.

## Brand sentence

Do not just delete your tweets. Visit them first. Decide what survives. Then close the archive.
