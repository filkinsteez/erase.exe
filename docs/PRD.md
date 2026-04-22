# Product Requirements Document: tweet-delete

## Summary

tweet-delete is a secure, theatrical app for deleting old public X posts. Users connect an account, walk through old archive rooms, search by keyword and date, add posts to a burn bag, review what will disappear, type a deletion poem, and then execute a controlled deletion job.

The app should not feel like a generic cleanup tool. It should feel like operating a strange memory machine.

## Product thesis

Deleting your old posts should feel less like cleaning a database and more like walking through an abandoned house you used to live in.

## Primary user promise

tweet-delete helps users explore and remove public posts while making destructive action slow, clear, secure, and memorable.

## Core experience

1. User enters a low-fi terminal environment.
2. User connects their X account through OAuth.
3. App scans visible posts and optionally imports an X archive.
4. App presents old posts as archive rooms by year, keyword, media, reply status, and engagement.
5. User browses, searches, filters, and adds selected sets to a burn bag.
6. User reviews a random sample before sealing the burn bag.
7. App shows exact account, post count, sources, date range, and limitations.
8. User types a deletion poem with a literal final deletion sentence.
9. User executes the job with pause and abort for remaining work.
10. App produces a black box report.

## MVP scope

### Must have

- OAuth account connection
- Reverse chronological post browsing
- Year room browsing
- Keyword and exact phrase search
- Date range filters
- Post type filters: posts, replies, reposts, quote posts
- Burn bag queue
- Safe sample review
- Dry run summary
- Typed deletion verse
- Server-side deletion job queue
- Pause and abort remaining deletion
- Black box report
- Disconnect and purge local data control

### Should have

- X archive upload for deeper historical coverage
- Coverage badge showing what is visible through API versus archive import
- High visibility shelf based on engagement metrics where available
- Forgotten drawer for zero engagement posts
- Saved search presets
- Clemency list for posts spared from deletion

### Not MVP

- Scheduling future recurring deletes
- AI moral judgment of posts
- Deleting likes, DMs, bookmarks, or followers
- Browser extension
- Mobile native app

## Personas

### The reputation-conscious professional

Wants to clean old posts before a job search without accidentally deleting posts that still matter.

### The internet archaeologist

Wants to browse old public phases and make selective decisions.

### The dramatic power user

Wants the tool to feel weird, memorable, and intentional.

## Success metrics

- 80 percent of users complete at least one archive review before deletion.
- 90 percent of deletion jobs include at least one filter or sample review step.
- Less than 1 percent of support contacts involve accidental deletion confusion.
- More than 40 percent of users download or view the black box report.
- Users describe the product as fun, memorable, or ritualistic in qualitative feedback.

## Risks

- X API access, rate limits, pricing, and historical reach can change.
- Users may misunderstand what the app can see without an archive import.
- Archive uploads may contain sensitive data beyond posts.
- The playful experience could obscure seriousness if copy is not careful.

## Guardrails

- The final screen must always use literal destructive copy.
- The app must never imply deleted posts can be restored.
- The app must always show what is not being touched.
- The app must not use fake urgency or pressured countdowns.
- The app must not delete from the browser.
