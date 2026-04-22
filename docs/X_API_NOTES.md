# X API Notes

These notes were prepared for implementation planning and should be rechecked before production release.

## Official docs to review

- X OAuth 2.0 Authorization Code with PKCE: https://docs.x.com/fundamentals/authentication/oauth-2-0/authorization-code
- X OAuth 2.0 user access token guide: https://docs.x.com/fundamentals/authentication/oauth-2-0/user-access-token
- X timelines overview: https://docs.x.com/x-api/posts/timelines/introduction
- X timelines integration guide: https://docs.x.com/x-api/posts/timelines/integrate
- X delete post endpoint: https://docs.x.com/x-api/posts/delete-post

## Implementation facts to verify before launch

- Delete Post uses `DELETE /2/tweets/{id}` and deletes a specific Post by ID when owned by the authenticated user.
- The user posts timeline endpoint is documented as `GET /2/users/:id/tweets`.
- X timeline documentation currently describes the user posts timeline as reaching up to the 3,200 most recent Posts.
- OAuth 2.0 with PKCE supports fine-grained scopes.
- Refresh tokens require requesting `offline.access`.

## Scopes to evaluate

Minimum likely scopes:

```txt
tweet.read
users.read
tweet.write
```

Optional depending on product behavior:

```txt
offline.access
```

Do not request DM, likes, follows, or other scopes unless a future feature truly needs them.

## Product limitation copy

Use clear copy when the app has not imported an archive:

```txt
Coverage warning:
Without an archive import or elevated historical access, this app may only see a limited slice of your post history through the connected API.
```

## Deletion behavior

Real deletion should be implemented as a server-side job that calls the official delete endpoint one post ID at a time. Do not run deletion from the browser. Do not let the client invent post IDs without server-side ownership validation.
