# Experience Spec

## North star

tweet-delete is a haunted DOS archive. The user walks through old public memory, collects posts into a burn bag, types a deletion poem, and closes the archive.

## Interface mood

- Low-fi terminal
- Monospace typography
- Scanlines
- Green or amber glow
- Chunky panels
- Fake command output mixed with real controls
- Buttons that feel like commands
- No polished SaaS dashboard energy

## Main screens

### Boot screen

Purpose: establish fantasy and security posture.

Sample copy:

```txt
tweet-delete
PUBLIC MEMORY RECOVERY ENVIRONMENT
ACCOUNT LINK: WAITING
DELETION ACCESS: LOCKED
PRESS ENTER TO DESCEND
```

### Account link screen

Purpose: connect X through OAuth without asking for passwords.

Required copy:

```txt
NO PASSWORDS STORED
NO DMS TOUCHED
NO LIKES MODIFIED
DELETE ACCESS LOCKED UNTIL FINAL AUTHORIZATION
```

### Archive map

Purpose: browse years as rooms.

Each room shows:

- Year
- Post count
- Top terms
- Mood label
- Status label
- Open room action
- Add room to burn bag action

Example:

```txt
ROOM: 2016
POSTS: 1,203
STATUS: UNSTABLE
MOOD: CONFIDENT
SIGNALS: founder, take, lol
```

### Signal scan

Purpose: keyword and date search.

Inputs:

- Keyword or exact phrase
- Date start
- Date end
- Type filters
- Include or exclude replies
- Include or exclude reposts
- Include or exclude media

Output:

```txt
SCAN TERM: "hire me"
DATE RANGE: 2014-01-01 TO 2020-12-31
MATCHES FOUND: 27
FIRST STEP: REVIEW BEFORE QUEUE
```

### Artifact review

Purpose: show real post samples before destructive action.

Required actions:

- Keep in burn bag
- Spare this
- Open on X where possible
- Show post date, type, engagement, source, and text

### Burn bag

Purpose: central selected deletion queue.

States:

- Empty
- Unsealed
- Sealed
- Armed
- Executing
- Complete
- Aborted

Required fields:

- Account handle
- Total queued posts
- Sources
- Date range
- Post type summary
- Spared count
- Coverage badge

### Final room

Purpose: final destructive acknowledgement.

Required fields:

- Account handle
- Total post count
- Date range
- Sources
- What is not touched
- Irreversibility warning
- Deletion verse input

### Deletion verse

The user must type a short poem or narrative. The last line must be literal.

Template:

```txt
I walked the archive.
I opened the boxes.
I searched through {sources}.
If I delete this, who will meet me?
Who will hire me?
Who will love me?
I have seen what is leaving.
Delete {post_count} posts from {handle}.
```

Rules:

- The final literal line must match exactly.
- The typed verse must be verified server-side before a live deletion job starts.
- The poem must not replace clear deletion facts.
- The poem should slow the user down and make the action feel intentional.

### Purge progress

Purpose: show batch deletion status.

Required copy:

```txt
PURGE SEQUENCE ACTIVE
ALREADY DELETED POSTS CANNOT BE RESTORED BY THIS APP
PAUSE AND ABORT ONLY STOP REMAINING WORK
```

Required controls:

- Pause
- Resume
- Abort remaining

### Black box report

Purpose: accountability and closure.

Fields:

- Account handle
- Started at
- Completed at
- Deleted count
- Failed count
- Spared count
- Sources
- Filters
- Coverage mode
- Job ID

## In-world naming

| Standard term | In-world term |
|---|---|
| Dashboard | Command center |
| Search | Signal scan |
| Reverse chronological browsing | Timeline descent |
| Filter | Targeting rule |
| Delete queue | Burn bag |
| Excluded posts | Clemency list |
| Dry run | Rehearsal |
| Confirmation | Deletion verse |
| Delete job | Purge sequence |
| Audit log | Black box report |
| Disconnect account | Sever link |
