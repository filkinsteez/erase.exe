# User Stories

## Archive exploration

As a user, I want to enter my old posts by year so I can understand the phases I am about to delete.

Acceptance criteria:

- I can see year rooms with counts and top terms.
- I can open a room and browse posts newest first.
- I can switch to oldest first.
- I can add a whole room to the burn bag.
- I can spare individual posts.

## Keyword search

As a user, I want to search for keywords and exact phrases so I can find old themes I no longer want public.

Acceptance criteria:

- I can search a term.
- I can search an exact phrase.
- I can combine search with date filters.
- I can preview results before queueing.
- I can add matching results to the burn bag.

## Date filtering

As a user, I want to target a date range so I can delete posts from a specific era.

Acceptance criteria:

- I can choose start and end dates.
- Results show count, sample, and date range.
- The final confirmation repeats the selected date range.

## Burn bag

As a user, I want a safe holding area for selected posts so I can review before deletion.

Acceptance criteria:

- Adding posts to the burn bag does not delete anything.
- The burn bag shows count, account, sources, and spared posts.
- I can empty the bag.
- I can spare posts.
- I can proceed only when the bag contains posts.

## Sample review

As a user, I want to review random samples from a large deletion queue so I can catch mistakes.

Acceptance criteria:

- Large burn bags require sample review.
- Each sample shows text, date, type, and source.
- I can spare a sample.
- I can keep a sample in the burn bag.

## Deletion verse

As a user, I want the final confirmation to feel serious and memorable so I slow down before deletion.

Acceptance criteria:

- I must type a poem or narrative exactly.
- The final line includes the account and post count.
- The system rejects incorrect text.
- The final line is checked server-side.

## Purge sequence

As a user, I want to see progress and stop remaining deletion if I panic.

Acceptance criteria:

- I can see deleted, failed, and remaining counts.
- I can pause the job.
- I can resume the job.
- I can abort remaining deletion.
- The UI tells me that already deleted posts cannot be restored.

## Black box report

As a user, I want a report after deletion so I have a record of what happened.

Acceptance criteria:

- Report includes account, count, filters, sources, started time, completed time, and failures.
- I can download the report.
- Report does not include secrets.
