# Agent instructions

You are building tweet-delete, a secure and playful public post deletion app.

## Product intent

The app must feel like a low-fi DOS archive, haunted evidence locker, and controlled destruction ritual. Deleting posts is secondary to the novel experience of walking through old public memory.

## Voice

Use precise destructive language when actions are risky. Use poetic language only around exploration and ritual. The final confirmation must always include a literal sentence such as `Delete 1,248 posts from @username.`

## Engineering principles

- Keep destructive functionality server-side.
- Treat all tokens, uploaded archives, and post content as sensitive.
- Prefer small composable components.
- Prefer typed domain models and schema validation.
- Add tests for confirmation, queue hashing, authorization, and archive parsing.
- Do not implement real deletion until dry run, audit logging, and token encryption are complete.

## UX principles

- Queueing is safe.
- Sealing is serious.
- Deleting is irreversible.
- The user must always know the account, post count, selected filters, and limitations.
- The app must always distinguish simulation from live deletion.
